import unittest
from scripts.autonomous.protocol import (Rejected, compact_controller, fresh_controller,
                                         register_goal, recall_memory)


class Connection:
    def __init__(self, events=()):
        self.events, self.calls = list(events), []
        self.goal = None
        self.thread = {'id': 'old', 'status': {'type': 'idle'}}
        self.fresh = {'id': 'new', 'model': 'gpt-6.1-sol', 'reasoningEffort': 'medium',
                      'turns': [], 'ephemeral': False}

    def request(self, method, params, timeout):
        self.calls.append((method, params))
        if method == 'thread/read':
            return {'thread': self.thread}
        if method == 'thread/start':
            return {'thread': self.fresh}
        if method == 'thread/goal/get':
            return {'goal': self.goal}
        if method == 'thread/goal/set':
            self.goal = {'threadId': params['threadId'], 'objective': params['objective'], 'status': 'active',
                         'tokenBudget': params.get('tokenBudget')}
        return {}

    def drain_events(self):
        pass  # Test queue models events arriving AFTER request, not stale history.

    def next_event(self, timeout):
        if self.events:
            return self.events.pop(0)
        return None


def lifecycle(thread='old', status='completed', item='compact'):
    return [
        {'method': 'item/started', 'params': {'threadId': thread, 'turnId': 'turn', 'item': {'id': item, 'type': 'contextCompaction'}}},
        {'method': 'item/completed', 'params': {'threadId': thread, 'turnId': 'turn', 'item': {'id': item, 'type': 'contextCompaction'}}},
        {'method': 'turn/completed', 'params': {'threadId': thread, 'turn': {'id': 'turn', 'status': status}}},
    ]


class Memory:
    def __init__(self):
        self.calls = []
        self.fail = False
        self.alt = None
        self.truncated = False
        self.bad_readback = False
        self.ws = 'studio_suite_v2'

    def installed_skills(self):
        self.calls.append('skills')
        if self.fail:
            raise OSError('unavailable')
        return {k: 'installed instructions' for k in ('memory', 'work-history', 'scar-tissue', 'todo')}

    def policy(self):
        self.calls.append('policy')
        return {'stopOnMemoryFailure': True}

    def workspace(self):
        self.calls.append('workspace')
        return self.ws

    def query(self, category, scoped):
        self.calls.append((category, scoped))
        if scoped:
            return []
        return [{'id': category, 'createdAt': '2026-10-08', 'summary': 'relevant', 'truncated': self.truncated}]

    def get(self, ident):
        self.calls.append(('get', ident))
        return {'id': 'wrong' if self.bad_readback else ident, 'createdAt': '2026-10-08', 'summary': 'full'}

    def documented_alternative(self):
        self.calls.append('alternative')
        return self.alt


class EnvironmentConnection(Connection):
    """Synthetic installed 0.161 protocol semantics, not a live tool proof.

    ThreadStartParams.environments: omitted selects the default when enabled;
    empty disables access for turns without an override. TurnStartParams:
    omitted inherits sticky selection; empty disables access for that turn.
    Keep this behavior model independent of fresh_controller's request shape.
    """
    def __init__(self):
        super().__init__()
        self.default_environment = 'qualified-native-default'
        self.sticky_environments = None

    def request(self, method, params, timeout):
        if method == 'thread/start':
            self.sticky_environments = params.get('environments', [self.default_environment])
        if method == 'turn/start':
            self.calls.append((method, params))
            selected = params.get('environments', self.sticky_environments)
            return {'filesystem_read_available': bool(selected),
                    'environment': selected[0] if selected else None}
        return super().request(method, params, timeout)


class ProtocolTests(unittest.TestCase):
    def test_documented_empty_environment_disables_unoverridden_turn_tools(self):
        c = EnvironmentConnection()
        c.request('thread/start', {'environments': []}, 60)
        r = c.request('turn/start', {'threadId': 'new', 'input': []}, 60)
        self.assertFalse(r['filesystem_read_available'])
        self.assertIsNone(r['environment'])
        # Explicit empty turn selection also disables a default-enabled thread.
        c.request('thread/start', {}, 60)
        self.assertTrue(c.request('turn/start', {'threadId': 'new'}, 60)['filesystem_read_available'])
        self.assertFalse(c.request('turn/start', {'threadId': 'new', 'environments': []}, 60)
                         ['filesystem_read_available'])

    def test_fresh_controller_retains_default_tools_without_broader_grants(self):
        c = EnvironmentConnection()
        r = fresh_controller(c, old_thread_id='old', profile='qualified-root-deny', cwd='/isolated',
                             standing_instructions='memory first', checkpoint='/checkpoint', next_phase_id='R0')
        method, params = c.calls[-1]
        self.assertEqual(method, 'thread/start')
        self.assertEqual(params, {
            'model': 'gpt-6.1-sol', 'allowProviderModelFallback': False,
            'ephemeral': False, 'permissions': 'qualified-root-deny', 'cwd': '/isolated',
            'approvalPolicy': 'never', 'experimentalRawEvents': False,
            'baseInstructions': 'memory first', 'config': {'model_reasoning_effort': 'medium'}})
        # Bootstrap has no turn-level environment override: sticky default must
        # retain filesystem tooling without sandbox/grant/history overrides.
        bootstrap = c.request('turn/start', {'threadId': r['thread_id'], 'input': []}, 60)
        self.assertTrue(bootstrap['filesystem_read_available'])
        self.assertEqual(bootstrap['environment'], c.default_environment)
        self.assertEqual(r['input'], {'checkpoint': '/checkpoint', 'next_phase_id': 'R0'})

    def test_actual_controller_compaction_lifecycle(self):
        c = Connection([{'method': 'reasoning/textDelta', 'params': {'text': 'never retained'}}] + lifecycle('other') + lifecycle())
        r = compact_controller(c, 'old', role='controller', green_verified=True)
        self.assertEqual(r, {'thread_id': 'old', 'turn_id': 'turn', 'item_id': 'compact', 'completed': True})
        self.assertEqual(c.calls[-1], ('thread/compact/start', {'threadId': 'old'}))
        self.assertNotIn('text', str(r))

    def test_ack_is_not_completion_and_no_replay(self):
        c = Connection()
        with self.assertRaises(Rejected):
            compact_controller(c, 'old', role='controller', green_verified=True, timeout=.002)
        self.assertEqual(sum(m == 'thread/compact/start' for m, _ in c.calls), 1)

    def test_failed_unmatched_and_missing_lifecycle(self):
        for events in [lifecycle(status='failed'), lifecycle()[1:], lifecycle()[:1] + lifecycle()[2:]]:
            with self.subTest(events=events), self.assertRaises(Rejected):
                compact_controller(Connection(events), 'old', role='controller', green_verified=True, timeout=.002)

    def test_reviewers_active_or_non_green_cannot_compact(self):
        for role, green in [('reviewer', True), ('controller', False)]:
            c = Connection()
            with self.assertRaises(Rejected):
                compact_controller(c, 'old', role=role, green_verified=green)
            self.assertEqual(c.calls, [])
        c = Connection(); c.thread['status'] = {'type': 'active'}
        with self.assertRaises(Rejected):
            compact_controller(c, 'old', role='controller', green_verified=True)

    def test_fresh_start_no_context_fork_or_fallback(self):
        c = Connection()
        r = fresh_controller(c, old_thread_id='old', profile='memory-only', cwd='/tmp',
                             standing_instructions='standing', checkpoint='/checkpoint', next_phase_id='R0')
        self.assertEqual(r['thread_id'], 'new')
        method, params = c.calls[-1]
        self.assertEqual(method, 'thread/start')
        self.assertFalse(params['allowProviderModelFallback'])
        self.assertNotIn('history', params)
        for change in [{'id': 'old'}, {'turns': ['history']}, {'model': 'fallback'}, {'forkedFromId': 'old'}, {'ephemeral': True}]:
            c = Connection(); c.fresh.update(change)
            with self.subTest(change=change), self.assertRaises(Rejected):
                fresh_controller(c, old_thread_id='old', profile='memory-only', cwd='/tmp',
                                 standing_instructions='standing', checkpoint='/checkpoint', next_phase_id='R0')

    def test_goal_actual_registration_and_no_invented_budget(self):
        c = Connection(); g = register_goal(c, 'old', 'R0 full scope', available=True, authorized=True)
        self.assertEqual(g['status'], 'active')
        set_params = next(p for m, p in c.calls if m == 'thread/goal/set')
        self.assertNotIn('tokenBudget', set_params)
        self.assertEqual(set_params['origin'], 'user')
        count = len(c.calls)
        register_goal(c, 'old', 'R0 full scope', available=True, authorized=True)
        self.assertEqual(len(c.calls), count + 1)
        c.goal['status'] = 'complete'
        with self.assertRaises(Rejected):
            register_goal(c, 'old', 'R0 full scope', available=True, authorized=True)

    def test_goal_absence_and_unauthorized(self):
        c = Connection()
        self.assertFalse(register_goal(c, 'old', 'R0', available=False, authorized=True)['registered'])
        self.assertEqual(c.calls, [])
        with self.assertRaises(Rejected):
            register_goal(c, 'old', 'R0', available=True, authorized=False)

    def test_empty_scoped_recall_relaxes_and_truncated_fetches_full(self):
        m = Memory(); m.truncated = True
        r = recall_memory(m)
        self.assertEqual(m.calls[:3], ['skills', 'policy', 'workspace'])
        for category in r['records']:
            self.assertIn((category, False), m.calls)
            self.assertIn(('get', category), m.calls)
            self.assertEqual(r['records'][category][0]['summary'], 'full')

    def test_retry_once_then_alternative(self):
        m = Memory(); m.fail = True; m.alt = Memory()
        self.assertEqual(recall_memory(m)['workspace'], 'studio_suite_v2')
        self.assertEqual(m.calls.count('skills'), 2)
        self.assertEqual(m.calls.count('alternative'), 1)

    def test_failure_failed_full_readback_or_workspace_blocks(self):
        for configure in ('fail', 'bad_readback', 'ws'):
            m = Memory()
            if configure == 'ws': m.ws = 'other'
            else: setattr(m, configure, True)
            m.truncated = True
            with self.subTest(configure=configure), self.assertRaises(Rejected):
                recall_memory(m)
            self.assertEqual(m.calls.count('skills'), 2)
