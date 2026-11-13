"""Atomic branch lease, durable non-replaying journal and phase gate ordering."""
import fcntl
import hashlib
import json
import os
import re
import subprocess
from dataclasses import asdict
from pathlib import Path
from .protocol import require, Rejected, compact_controller, fresh_controller
from .review_host import canonical, digest
from .gate import publication_gate, memory_write_gate, reset_gate

STATES = ('QUEUED', 'SCOPED', 'BUILT', 'TESTED', 'REVIEWED', 'INTEGRATED', 'RECORDED', 'GREEN', 'RESET_CONFIRMED')
KINDS = {'SCOPED': 'scope', 'BUILT': 'build', 'TESTED': 'test', 'REVIEWED': 'outcome',
         'INTEGRATED': 'integration', 'RECORDED': 'records', 'GREEN': 'final_gate', 'RESET_CONFIRMED': 'reset'}

# Exact command identities frozen by the R0 acceptance contract. No caller can
# replace the suite with `true` or an unrelated successful command.
MANDATORY_COMMANDS = frozenset({
    'python3 -m unittest discover -s scripts/autonomous/tests -v',
    'python3 scripts/audit-design-source.py',
    'node scripts/check-design.mjs',
    'node scripts/check-token-compatibility.mjs',
    'git diff --check',
})


def validate_test_commands(receipt, binding):
    tests = receipt.get('commands')
    require(isinstance(tests, list) and len(tests) == len(MANDATORY_COMMANDS) and
            all(isinstance(t, dict) for t in tests), 'mandatory commands missing')
    require(all(isinstance(t.get('command'), str) for t in tests) and
            {t['command'] for t in tests} == MANDATORY_COMMANDS, 'mandatory command identities mismatch')
    for test in tests:
        output = test.get('output')
        require(test.get('binding') == asdict(binding) and type(test.get('exit_code')) is int and
                test['exit_code'] == 0 and isinstance(output, str) and
                test.get('output_sha256') == hashlib.sha256(output.encode('utf-8')).hexdigest() and
                test.get('skips') == [], 'command output/binding missing, failed or skipped')
        if test['command'] == 'python3 -m unittest discover -s scripts/autonomous/tests -v':
            lines = output.splitlines()
            suites = [line for line in lines if re.match(r'\s*Ran\b', line)]
            summaries = [line for line in lines if re.match(r'\s*(?:OK|FAILED)\b', line)]
            require(len(suites) == 1 and re.fullmatch(
                        r'Ran [1-9][0-9]* tests? in [0-9]+(?:\.[0-9]+)?s', suites[0]) and
                    summaries == ['OK'] and lines[-1:] == ['OK'] and
                    lines.index(suites[0]) < lines.index('OK') and
                    not re.search(r'\b(?:skipped|FAILED|ERROR|FAIL)\b', output, re.I),
                    'mandatory suite output malformed, contradictory, failed or skipped')
    require(receipt.get('mandatory_negative_tests') is True and receipt.get('required_skips', []) == [],
            'required tests unverified')


def process_identity():
    # Linux process start-time prevents PID reuse being mistaken for same owner.
    stat = Path('/proc/self/stat').read_text()
    return {'pid': os.getpid(), 'start_ticks': stat[stat.rfind(')') + 2:].split()[19]}


class Lease:
    """Kernel releases flock on crash. Never unlink lock inode or kill another owner."""
    def __init__(self, directory, branch):
        self.path = Path(directory) / (hashlib.sha256(branch.encode()).hexdigest() + '.lease')
        self.branch, self.fd, self.previous = branch, None, None

    def acquire(self):
        fd = os.open(self.path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            os.close(fd)
            raise Rejected('duplicate controller lease') from None
        self.fd = fd
        try:
            raw = os.read(fd, 16384)
            self.previous = json.loads(raw) if raw else None
            if self.previous:
                require(self.previous.get('branch') == self.branch, 'lease branch drift')
            self.identity = process_identity()
            value = {'branch': self.branch, **self.identity}
            os.lseek(fd, 0, os.SEEK_SET)
            os.ftruncate(fd, 0)
            os.write(fd, canonical(value))
            os.fsync(fd)
        except BaseException:
            self.close()
            raise
        return self

    def close(self):
        if self.fd is not None:
            fcntl.flock(self.fd, fcntl.LOCK_UN)
            os.close(self.fd)
            self.fd = None

    def __enter__(self):
        return self.acquire()

    def __exit__(self, *args):
        self.close()


class Journal:
    def __init__(self, path, binding):
        self.path, self.binding = Path(path), binding
        self.events = []
        if self.path.exists():
            data = self.path.read_bytes()
            require(not data or data.endswith(b'\n'), 'interrupted journal; reconcile before writes')
            for line in data.splitlines():
                event = json.loads(line)
                expected = event.pop('hash')
                require(event.get('previous') == (self.events[-1]['hash'] if self.events else None) and
                        event.get('binding') == asdict(binding) and digest(event) == expected, 'journal drift')
                event['hash'] = expected
                self.events.append(event)

    def append(self, event):
        # Reject an obsolete in-memory snapshot rather than corrupting the chain
        # after a controller reload. The caller holds the single branch lease.
        current = Journal(self.path, self.binding)
        require(current.events == self.events, 'stale journal snapshot; reload and reconcile')
        row = {**event, 'binding': asdict(self.binding), 'previous': self.events[-1]['hash'] if self.events else None}
        row['hash'] = digest(row)
        with self.path.open('ab') as f:
            f.write(canonical(row) + b'\n')
            f.flush()
            os.fsync(f.fileno())
        self.events.append(row)


class Supervisor:
    """No command replay on restart. Every advance rechecks actual Git/source facts.

    reconcile(binding) must inspect current candidate/tree/source/evidence and
    returns True only on exact equality. validators are external independent gate
    functions for scope/outcome/records/final review; never accept text verdicts.
    """
    def __init__(self, lease, journal, evidence, reconcile, validators):
        require(lease.fd is not None, 'controller lease required')
        self.lease, self.journal, self.evidence = lease, journal, evidence
        self.reconcile, self.validators = reconcile, validators
        self.state, self.pending, self.failure = 'QUEUED', None, None
        self.failures = []
        for event in journal.events:
            typ = event.get('type')
            if typ == 'begin':
                require(self.failure is None and self.pending is None and event['target'] == STATES[STATES.index(self.state) + 1], 'journal transition order')
                self.pending = event
            elif typ == 'commit':
                require(self.failure is None and self.pending and event['target'] == self.pending['target'] and event['ref'] == self.pending['ref'], 'orphan journal commit')
                # Hash-chain integrity alone is not proof a gate passed. Recheck
                # external receipts and actual Git/source facts on recovery.
                self.validate(event['target'], event['ref'])
                self.state, self.pending = event['target'], None
            elif typ == 'failure':
                require(event['status'] in ('FAILED', 'BLOCKED', 'REWORK') and
                        event.get('gate') in KINDS.values() and
                        isinstance(event.get('ref'), str) and event['ref'], 'invalid failure')
                self.failures.append(event)
                self.failure = event
            elif typ == 'reconciled_failure':
                self.validate_repair(event['ref'], event)
                self.failures.pop()
                self.failure = self.failures[-1] if self.failures else None
            else:
                raise Rejected('unknown journal event')
        require(self.reconcile(self.evidence.binding) is True, 'restart candidate/source/evidence drift')
        # Any pending mutation is unresolved. Caller must inspect actual facts and
        # receipts, then explicitly reconcile_pending; never rerun mutation here.

    def validate(self, target, ref):
        require(self.reconcile(self.evidence.binding) is True, 'candidate/source/evidence drift')
        receipt = self.evidence.get(ref, KINDS[target])
        if target in ('SCOPED', 'REVIEWED', 'RECORDED', 'GREEN'):
            require(target in self.validators and self.validators[target](receipt) is True, 'independent gate validation missing')
        if target == 'SCOPED':
            require(receipt.get('memory_first') is True and receipt.get('goal_lifecycle_verified') is True and
                    receipt.get('model') == 'gpt-6.1-sol' and receipt.get('effort') == 'medium', 'activation unverified')
        elif target == 'BUILT':
            require(receipt.get('allowed_paths_verified') is True and receipt.get('authority_unchanged') is True, 'build scope drift')
        elif target == 'TESTED':
            validate_test_commands(receipt, self.evidence.binding)
        elif target == 'INTEGRATED':
            require(receipt.get('fast_forward') is True and receipt.get('reviewed_bytes_equal') is True, 'unreviewed integration')
            publication_gate(receipt, commit=receipt.get('integration_commit'), branch=receipt.get('branch'))
        elif target == 'RECORDED':
            memory_write_gate(receipt)
            require(receipt.get('executable_equal') is True and receipt.get('records_review_fresh') is True, 'records review missing')
            publication_gate(receipt, commit=receipt.get('final_commit'), branch=receipt.get('branch'))
        elif target == 'GREEN':
            require(receipt.get('independent') is True and receipt.get('all_live_gates_verified') is True and
                    receipt.get('checkpoint_words', 1001) <= 1000 and receipt.get('checkpoint_sha256'), 'final gate missing')
        elif target == 'RESET_CONFIRMED':
            reset_gate(receipt['checkpoint'], receipt['compaction'], receipt['bootstrap'],
                       controller_thread_id=receipt['controller_thread_id'], final_commit=receipt['final_commit'],
                       source_sha256=self.evidence.binding.source_sha256)
        return receipt

    def advance(self, target, ref):
        require(self.lease.fd is not None and self.pending is None and self.failure is None,
                'lease missing, unresolved mutation or failed gate')
        require(self.state != STATES[-1] and target == STATES[STATES.index(self.state) + 1], 'invalid transition')
        self.validate(target, ref)
        self.journal.append({'type': 'begin', 'target': target, 'ref': ref})
        self.pending = self.journal.events[-1]
        self.journal.append({'type': 'commit', 'target': target, 'ref': ref})
        self.state, self.pending = target, None

    def reconcile_pending(self):
        require(self.lease.fd is not None and self.pending is not None and self.failure is None,
                'lease missing, no pending gate or failed gate')
        self.validate(self.pending['target'], self.pending['ref'])
        self.journal.append({'type': 'commit', 'target': self.pending['target'], 'ref': self.pending['ref']})
        self.state, self.pending = self.pending['target'], None

    def fail(self, status, gate, ref):
        require(self.lease.fd is not None, 'controller lease required')
        require(status in ('FAILED', 'BLOCKED', 'REWORK') and gate in KINDS.values() and
                isinstance(ref, str) and ref, 'invalid failure state/gate/ref')
        failed = self.evidence.receipts.get(ref)
        self.journal.append({'type': 'failure', 'status': status, 'gate': gate, 'ref': ref,
                             'failed_sha256': digest(failed) if failed is not None else None})
        self.failure = self.journal.events[-1]
        self.failures.append(self.failure)

    def validate_repair(self, ref, event=None):
        require(self.failure is not None, 'no failed gate to reconcile')
        target = next(target for target, kind in KINDS.items() if kind == self.failure['gate'])
        require(isinstance(ref, str) and ref and ref != self.failure['ref'], 'reused failed evidence')
        # A previously committed or reconciled receipt is not new repair proof.
        used = [e for e in self.journal.events if e['type'] in ('commit', 'reconciled_failure')]
        if event is not None:
            used = used[:next((i for i, e in enumerate(used) if e is event), len(used))]
        require(all(e['ref'] != ref for e in used), 'reused gate evidence')
        receipt = self.validate(target, ref)
        require(target in self.validators and self.validators[target](receipt) is True,
                'independent repair validation missing')
        sha = digest(receipt)
        require(sha != self.failure.get('failed_sha256') and
                all(sha != digest(self.evidence.receipts[e['ref']]) for e in used),
                'reused failed/accepted receipt bytes')
        if event is not None:
            require(event.get('failure_hash') == self.failure['hash'] and
                    event.get('receipt_sha256') == sha, 'repair receipt/failure drift')
        return sha

    def reconcile_failure(self, repaired_ref):
        """Durably release one failed gate, never a transition or waiver.

        Every gate needs its independent validator here, including build/test.
        Restart revalidates the exact repair bytes and failure association.
        Multiple failures each require separate distinct repair evidence.
        """
        require(self.lease.fd is not None, 'controller lease required')
        sha = self.validate_repair(repaired_ref)
        self.journal.append({'type': 'reconciled_failure', 'ref': repaired_ref,
                             'failure_hash': self.failure['hash'], 'receipt_sha256': sha})
        self.failures.pop()
        self.failure = self.failures[-1] if self.failures else None

    def product_eligible(self):
        return self.state == 'RESET_CONFIRMED' and self.pending is None and self.failure is None


def reset_existing_controller(connection, *, controller_thread_id, checkpoint, profile, cwd,
                              standing_instructions, verify_green):
    """External host calls only after independent GREEN, using this actual thread.

    Starts memory-only fresh controller; host must validate live bootstrap and
    feed its receipt through reset_gate before advancement. No marker substitute.
    """
    require(verify_green(checkpoint) is True and checkpoint.get('state') == 'GREEN', 'GREEN unverified')
    require(len(canonical(checkpoint).decode().split()) <= 1000, 'checkpoint too long')
    compact = compact_controller(connection, controller_thread_id, role='controller', green_verified=True)
    fresh = fresh_controller(connection, old_thread_id=controller_thread_id, profile=profile, cwd=cwd,
                             standing_instructions=standing_instructions,
                             checkpoint=checkpoint['checkpoint_path'], next_phase_id=checkpoint.get('next_phase_id'))
    return {'compaction': compact, 'fresh': fresh, 'status': 'bootstrap_unverified'}


def git_facts(root, git='/usr/bin/git'):
    def run(*args):
        return subprocess.check_output([git, '-C', str(root), *args], timeout=15, text=True).strip()
    return {'commit': run('rev-parse', 'HEAD'), 'tree': run('rev-parse', 'HEAD^{tree}'),
            'branch': run('branch', '--show-current'), 'status': run('status', '--porcelain')}
