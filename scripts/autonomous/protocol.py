"""Bounded functions for an already connected app-server. No transport secrets/logs.

Connection supplies request(method, params, timeout) and next_event(timeout).
Only factual lifecycle identifiers are returned; raw reasoning events are discarded.
"""
import time


class Rejected(ValueError):
    """Missing, stale, unsupported or contradictory evidence."""


def require(condition, message):
    if not condition:
        raise Rejected(message)


def compact_controller(connection, thread_id, *, role, green_verified, timeout=120):
    require(role == 'controller' and green_verified is True, 'only GREEN controller reset')
    require(0 < timeout <= 300, 'bounded timeout required')
    thread = connection.request('thread/read', {'threadId': thread_id, 'includeTurns': False}, timeout)['thread']
    require(thread['id'] == thread_id and thread['status']['type'] == 'idle', 'controller not idle')
    # Subscription must already be active; drain stale events before the request.
    connection.drain_events()
    connection.request('thread/compact/start', {'threadId': thread_id}, timeout)
    deadline = time.monotonic() + timeout
    started = None
    completed = False
    while time.monotonic() < deadline:
        event = connection.next_event(max(0.001, deadline - time.monotonic()))
        if event is None:
            continue
        method, p = event.get('method'), event.get('params', {})
        if p.get('threadId') != thread_id:
            continue
        if method == 'error':
            raise Rejected('compaction lifecycle error')
        if method == 'item/started' and p.get('item', {}).get('type') == 'contextCompaction':
            require(started is None, 'ambiguous compaction')
            started = (p['turnId'], p['item']['id'])
        elif method == 'item/completed' and p.get('item', {}).get('type') == 'contextCompaction':
            require(started == (p['turnId'], p['item']['id']), 'unmatched compaction completion')
            completed = True
        elif method == 'turn/completed' and started and p.get('turn', {}).get('id') == started[0]:
            require(completed and p['turn']['status'] == 'completed' and p['turn'].get('error') is None,
                    'failed/incomplete compaction')
            return {'thread_id': thread_id, 'turn_id': started[0], 'item_id': started[1], 'completed': True}
    raise Rejected('compaction observation unresolved; do not replay request')


def fresh_controller(connection, *, old_thread_id, profile, cwd, standing_instructions, checkpoint, next_phase_id):
    # No resume, fork, transcript, goal history or compaction payload accepted.
    # Installed ThreadStartParams: omit environments to select the qualified
    # native default; [] disables execution access on subsequent unoverridden
    # turns. Environment selection does not replace the named permission profile.
    params = {'model': 'gpt-6.1-sol', 'allowProviderModelFallback': False,
              'ephemeral': False, 'permissions': profile, 'cwd': cwd,
              'approvalPolicy': 'never', 'experimentalRawEvents': False,
              'baseInstructions': standing_instructions,
              'config': {'model_reasoning_effort': 'medium'}}
    response = connection.request('thread/start', params, 60)
    t = response['thread']
    require(t['id'] != old_thread_id and t.get('forkedFromId') is None and t.get('parentThreadId') is None,
            'not a distinct fresh controller')
    require(t.get('turns') == [] and t.get('model') == 'gpt-6.1-sol' and
            t.get('reasoningEffort') == 'medium', 'fresh launch configuration unverified')
    require(t.get('ephemeral') is False, 'persistent Goal-capable controller required')
    return {'thread_id': t['id'], 'input': {'checkpoint': checkpoint, 'next_phase_id': next_phase_id}}


def register_goal(connection, thread_id, objective, *, available, authorized, token_budget=None):
    require(authorized is True, 'Goal activation requires explicit user objective')
    if not available:
        return {'available': False, 'registered': False}
    existing = connection.request('thread/goal/get', {'threadId': thread_id}, 30).get('goal')
    if existing:
        require(existing['objective'] == objective and existing['status'] == 'active', 'different/terminal active Goal')
        require(existing.get('tokenBudget') == token_budget, 'Goal budget mismatch')
        return existing
    params = {'threadId': thread_id, 'objective': objective, 'origin': 'user'}
    if token_budget is not None:
        require(type(token_budget) is int and token_budget > 0, 'invalid explicit budget')
        params['tokenBudget'] = token_budget
    connection.request('thread/goal/set', params, 30)
    goal = connection.request('thread/goal/get', {'threadId': thread_id}, 30).get('goal')
    require(goal and goal['threadId'] == thread_id and goal['objective'] == objective and
            goal['status'] == 'active' and goal.get('tokenBudget') == token_budget, 'Goal readback failed')
    return goal


def recall_memory(bridge):
    """Bridge implements installed_skills/policy/workspace/query/get; read-only.

    Exceptions retry once, then documented alternative bridge once. Empty queries
    relax filters. Truncated summaries require exact-ID full records/readback.
    """
    def retrieve(b):
        skills = b.installed_skills()
        require(set(skills) == {'memory', 'work-history', 'scar-tissue', 'todo'} and
                all(isinstance(x, str) and x for x in skills.values()), 'installed skills missing')
        policy = b.policy()
        require(type(policy.get('stopOnMemoryFailure')) is bool, 'policy unverified')
        require(b.workspace() == 'studio_suite_v2', 'wrong workspace')
        groups = {}
        for category in ('work-history', 'scar-tissue', 'todo'):
            rows = b.query(category, scoped=True)
            if not rows:
                rows = b.query(category, scoped=False)
            require(isinstance(rows, list), 'malformed recall')
            full = []
            for row in rows:
                require(row.get('id') and row.get('createdAt'), 'recall IDs/dates missing')
                if row.get('truncated'):
                    fetched = b.get(row['id'])
                    require(fetched.get('id') == row['id'] and not fetched.get('truncated') and
                            fetched.get('createdAt') == row['createdAt'], 'full record readback failed')
                    row = fetched
                require(row.get('summary'), 'empty summary')
                full.append(row)
            groups[category] = full
        return {'workspace': 'studio_suite_v2', 'skills': skills, 'policy': policy, 'records': groups}
    for _ in range(2):
        try:
            return retrieve(bridge)
        except (Rejected, OSError, RuntimeError):
            pass
    alternative = bridge.documented_alternative()
    if alternative is not None:
        try:
            return retrieve(alternative)
        except (Rejected, OSError, RuntimeError):
            pass
    raise Rejected('memory failure: checkpoint and block advancement')
