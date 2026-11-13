import copy
import hashlib
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from dataclasses import asdict
from scripts.autonomous.protocol import Rejected
from scripts.autonomous.gate import Evidence, freeze_git_tree, compare_final_manifests
from scripts.autonomous.supervisor import Lease, Journal, Supervisor, STATES, reset_existing_controller, MANDATORY_COMMANDS
from scripts.autonomous.tests.test_gate import binding, receipt, publication, memory_write, reset_facts
from scripts.autonomous.tests.test_protocol import Connection, lifecycle


def receipts():
    c, comp, boot = reset_facts()
    return {
        'scope': receipt('scope', memory_first=True, goal_lifecycle_verified=True, model='gpt-6.1-sol', effort='medium'),
        'build': receipt('build', allowed_paths_verified=True, authority_unchanged=True),
        'test': receipt('test', commands=test_commands(), mandatory_negative_tests=True),
        'outcome': receipt('outcome'),
        'integration': receipt('integration', **publication(), integration_commit='b'*40, fast_forward=True, reviewed_bytes_equal=True),
        'records': receipt('records', **publication(), **memory_write(), final_commit='b'*40, executable_equal=True, records_review_fresh=True),
        'final_gate': receipt('final_gate', independent=True, all_live_gates_verified=True, checkpoint_words=200, checkpoint_sha256='a'*64),
        'reset': receipt('reset', checkpoint=c, compaction=comp, bootstrap=boot, controller_thread_id='controller', final_commit='b'*40),
    }


def test_commands():
    # Explicitly synthetic outputs: these only qualify disposable state tests.
    commands = []
    for command in sorted(MANDATORY_COMMANDS):
        output = 'synthetic fixture\nRan 43 tests in 0.1s\n\nOK\n' if 'unittest' in command else 'synthetic fixture\n'
        commands.append({'command': command, 'exit_code': 0, 'output': output,
                         'output_sha256': hashlib.sha256(output.encode()).hexdigest(),
                         'binding': asdict(binding()), 'skips': []})
    return commands


class SupervisorTests(unittest.TestCase):
    def test_tested_rejects_generic_true_and_missing_duplicate_or_substituted_commands(self):
        s = self.controller(); s.advance('SCOPED', 'scope'); s.advance('BUILT', 'build')
        good = copy.deepcopy(self.receipts['test'])
        bad_sets = [[{'command': 'true', 'exit_code': 0, 'output_sha256': 'a'*64}],
                    good['commands'][:-1], good['commands'][:-1] + [good['commands'][0]]]
        for index in range(len(good['commands'])):
            changed = copy.deepcopy(good['commands']); changed[index]['command'] = 'true'
            bad_sets.append(changed)
        for commands in bad_sets:
            self.receipts['test'] = {**good, 'commands': commands}
            with self.subTest(commands=commands), self.assertRaises(Rejected): s.advance('TESTED', 'test')
            self.assertEqual(s.state, 'BUILT'); self.assertEqual(len(self.journal.events), 4)
        self.receipts['test'] = good
        s.advance('TESTED', 'test')

    def test_each_mandatory_command_requires_bound_raw_output_success_and_no_skips(self):
        s = self.controller(); s.advance('SCOPED', 'scope'); s.advance('BUILT', 'build')
        good = copy.deepcopy(self.receipts['test'])
        for index in range(len(good['commands'])):
            for field, value in [('output', None), ('output_sha256', '0'*64), ('binding', {}),
                                 ('exit_code', 1), ('exit_code', True), ('skips', ['required']), ('skips', None)]:
                bad = copy.deepcopy(good); bad['commands'][index][field] = value
                self.receipts['test'] = bad
                with self.subTest(index=index, field=field, value=value), self.assertRaises(Rejected):
                    s.advance('TESTED', 'test')
        for output in ('', 'true\n', 'Ran 0 tests in 0s\n\nOK\n',
                       'Ran 43 tests in 0s\n\nOK (skipped=1)\n',
                       'test_required ... skipped\nRan 43 tests in 0s\n\nOK\n'):
            bad = copy.deepcopy(good)
            row = next(t for t in bad['commands'] if 'unittest' in t['command'])
            row.update(output=output, output_sha256=hashlib.sha256(output.encode()).hexdigest())
            self.receipts['test'] = bad
            with self.subTest(output=output), self.assertRaises(Rejected): s.advance('TESTED', 'test')
        self.assertEqual(s.state, 'BUILT')
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.lease = Lease(self.root, 'candidate').acquire(); self.addCleanup(self.lease.close)
        self.journal = Journal(self.root / 'journal.jsonl', binding())
        self.receipts = receipts()
        self.evidence = Evidence(binding(), self.receipts, lambda *a: True, synthetic=True)
        self.match = True
        self.validators = {s: lambda r: True for s in ('SCOPED', 'REVIEWED', 'RECORDED', 'GREEN')}

    def controller(self):
        return Supervisor(self.lease, self.journal, self.evidence, lambda _: self.match, self.validators)

    def test_full_disposable_synthetic_qualification_order_and_restart(self):
        s = self.controller()
        for index, (state, ref) in enumerate(zip(STATES[1:], self.receipts), 1):
            s.advance(state, ref)
            self.assertEqual(s.state, state)
            self.assertEqual(s.product_eligible(), state == 'RESET_CONFIRMED')
            # Rehydrate durable journal without replaying a mutation.
            s = Supervisor(self.lease, Journal(self.root / 'journal.jsonl', binding()), self.evidence,
                           lambda _: True, self.validators)
            self.assertEqual(s.state, state)
            self.assertEqual(len(s.journal.events), 2 * index)
            pair = s.journal.events[-2:]
            self.assertEqual([e['type'] for e in pair], ['begin', 'commit'])
            self.assertEqual([e['target'] for e in pair], [state, state])
            self.assertEqual([e['ref'] for e in pair], [ref, ref])
        # self.journal is the original snapshot; recovered controllers own newer
        # Journal instances. Assert the authoritative disk/recovered journal.
        disk = Journal(self.root / 'journal.jsonl', binding())
        self.assertEqual(len(disk.events), 16)
        self.assertEqual(disk.events, s.journal.events)
        self.assertEqual([e['target'] for e in disk.events if e['type'] == 'commit'], list(STATES[1:]))

    def test_arbitrary_phase_text_cannot_promote(self):
        s = self.controller()
        for target, ref in [('GREEN', 'final_gate'), ('PASSED', 'scope'), ('SCOPED', 'missing')]:
            with self.assertRaises(Rejected): s.advance(target, ref)
        self.assertEqual(s.state, 'QUEUED'); self.assertEqual(self.journal.events, [])

    def test_failed_states_preserve_last_success_and_deny_dependent_work(self):
        s = self.controller(); s.advance('SCOPED', 'scope')
        for status in ('FAILED', 'REWORK', 'BLOCKED'):
            s.fail(status, 'test', 'raw-failure')
            self.assertEqual(s.state, 'SCOPED'); self.assertFalse(s.product_eligible())
            with self.assertRaises(Rejected): s.advance('REVIEWED', 'outcome')

    def test_candidate_source_evidence_drift_on_transition_and_restart(self):
        s = self.controller(); s.advance('SCOPED', 'scope'); self.match = False
        with self.assertRaises(Rejected): s.advance('BUILT', 'build')
        with self.assertRaises(Rejected): self.controller()
        self.assertEqual(s.state, 'SCOPED')

    def test_independent_review_validation_cannot_be_waived(self):
        s = self.controller()
        self.validators['SCOPED'] = lambda _: False
        with self.assertRaises(Rejected): s.advance('SCOPED', 'scope')
        self.assertEqual(s.state, 'QUEUED')

    def test_incomplete_gate_restart_never_counts_as_passed_or_replays(self):
        self.journal.append({'type': 'begin', 'target': 'SCOPED', 'ref': 'scope'})
        s = self.controller()
        self.assertEqual(s.state, 'QUEUED'); self.assertIsNotNone(s.pending)
        with self.assertRaises(Rejected): s.advance('SCOPED', 'scope')
        self.receipts['scope']['status'] = 'unverified'
        with self.assertRaises(Rejected): s.reconcile_pending()
        self.assertEqual(s.state, 'QUEUED')
        self.receipts['scope']['status'] = 'pass'
        s.reconcile_pending(); self.assertEqual(s.state, 'SCOPED')

    def test_journal_tamper_and_torn_write_blocks(self):
        s = self.controller(); s.advance('SCOPED', 'scope')
        path = self.root / 'journal.jsonl'; original = path.read_bytes()
        path.write_bytes(original.replace(b'SCOPED', b'GREEN'))
        with self.assertRaises(Rejected): Journal(path, binding())
        path.write_bytes(original + b'{"incomplete":')
        with self.assertRaises(Rejected): Journal(path, binding())

    def test_concurrent_subprocess_duplicate_then_killed_owner_reconciled(self):
        self.lease.close()
        code = '''import sys\nfrom scripts.autonomous.supervisor import Lease\nl=Lease(sys.argv[1], 'candidate').acquire()\nprint('ACQUIRED', flush=True)\nsys.stdin.read()\n'''
        owner = subprocess.Popen([sys.executable, '-B', '-c', code, str(self.root)], stdin=subprocess.PIPE,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            import selectors
            with selectors.DefaultSelector() as selector:
                selector.register(owner.stdout, selectors.EVENT_READ)
                self.assertTrue(selector.select(10), 'lease subprocess observation timeout')
            self.assertEqual(owner.stdout.readline().strip(), 'ACQUIRED')
            with self.assertRaises(Rejected): Lease(self.root, 'candidate').acquire()
            second = subprocess.run([sys.executable, '-B', '-c', code, str(self.root)], input='', capture_output=True, text=True, timeout=10)
            self.assertNotEqual(second.returncode, 0)
            self.assertIn('duplicate controller lease', second.stderr)
            owner.kill(); owner.wait(timeout=10)  # Only owned disposable process.
            self.lease = Lease(self.root, 'candidate').acquire()
            self.addCleanup(self.lease.close)
            self.assertEqual(self.lease.previous['pid'], owner.pid)
            self.assertNotEqual(self.lease.identity['pid'], owner.pid)
            s = self.controller(); self.assertEqual(s.state, 'QUEUED')
        finally:
            if owner.poll() is None: owner.kill(); owner.wait(timeout=10)
            for stream in (owner.stdin, owner.stdout, owner.stderr): stream.close()

    def test_owned_lease_close_does_not_remove_inode(self):
        inode = self.lease.path.stat().st_ino
        self.lease.close(); self.lease.acquire()
        self.assertEqual(self.lease.path.stat().st_ino, inode)
        self.assertEqual(self.lease.previous['pid'], os.getpid())

    def test_real_git_tree_freeze_detects_records_vs_executable_drift(self):
        root = self.root / 'git'; root.mkdir()
        def git(*args):
            return subprocess.check_output(['/usr/bin/git', '-C', str(root), *args], text=True, stderr=subprocess.DEVNULL, timeout=15).strip()
        git('init'); git('config', 'user.name', 'Disposable'); git('config', 'user.email', 'fixture@example.invalid')
        (root / 'app.py').write_text('app'); (root / 'README.md').write_text('old')
        git('add', '.'); git('commit', '-m', 'fixture')
        first = freeze_git_tree(root, git('rev-parse', 'HEAD'))
        (root / 'README.md').write_text('new'); git('add', '.'); git('commit', '-m', 'records fixture')
        second = freeze_git_tree(root, git('rev-parse', 'HEAD'))
        self.assertEqual(compare_final_manifests(first, second), {'README.md'})
        git('update-index', '--chmod=+x', 'README.md'); git('commit', '-m', 'executable records fixture')
        executable_record = freeze_git_tree(root, git('rev-parse', 'HEAD'))
        self.assertEqual(executable_record['README.md']['sha256'], second['README.md']['sha256'])
        self.assertEqual(executable_record['README.md']['mode'], '100755')
        with self.assertRaises(Rejected): compare_final_manifests(second, executable_record)
        git('update-index', '--chmod=-x', 'README.md'); git('commit', '-m', 'regular records fixture')
        (root / 'app.py').write_text('drift'); git('add', '.'); git('commit', '-m', 'drift fixture')
        with self.assertRaises(Rejected): compare_final_manifests(first, freeze_git_tree(root, git('rev-parse', 'HEAD')))

    def test_existing_controller_reset_returns_unverified_fresh_bootstrap(self):
        c = Connection(lifecycle()); checkpoint = {'state': 'GREEN', 'checkpoint_path': '/factual.md', 'next_phase_id': 'R0-C'}
        result = reset_existing_controller(c, controller_thread_id='old', checkpoint=checkpoint, profile='memory-only',
                                           cwd='/tmp', standing_instructions='standing', verify_green=lambda _: True)
        self.assertEqual(result['compaction']['thread_id'], 'old')
        self.assertEqual(result['status'], 'bootstrap_unverified')
        self.assertEqual(result['fresh']['thread_id'], 'new')
        with self.assertRaises(Rejected): reset_existing_controller(c, controller_thread_id='old', checkpoint=checkpoint,
            profile='memory-only', cwd='/tmp', standing_instructions='standing', verify_green=lambda _: False)

    def test_stale_journal_snapshot_cannot_append_after_restart(self):
        original = self.journal
        s = self.controller(); s.advance('SCOPED', 'scope')
        recovered = Journal(self.root / 'journal.jsonl', binding())
        s = Supervisor(self.lease, recovered, self.evidence, lambda _: True, self.validators)
        s.advance('BUILT', 'build')
        with self.assertRaises(Rejected):
            original.append({'type': 'failure', 'status': 'BLOCKED', 'gate': 'test', 'ref': 'stale'})
        self.assertEqual(len(Journal(self.root / 'journal.jsonl', binding()).events), 4)

    def test_recovery_revalidates_committed_receipts_not_only_hash_chain(self):
        s = self.controller(); s.advance('SCOPED', 'scope')
        original = copy.deepcopy(self.receipts['scope'])
        for change in ({'status': 'unverified'}, {'memory_first': False}, {'provenance': 'live'}):
            self.receipts['scope'] = {**original, **change}
            with self.subTest(change=change), self.assertRaises(Rejected):
                Supervisor(self.lease, Journal(self.root / 'journal.jsonl', binding()), self.evidence,
                           lambda _: True, self.validators)
        self.receipts['scope'] = original
        recovered = self.controller()
        self.assertEqual(recovered.state, 'SCOPED')

    def test_recovered_repaired_failure_matches_live_state(self):
        s = self.controller(); s.fail('REWORK', 'scope', 'failure')
        with self.assertRaises(Rejected): s.advance('SCOPED', 'scope')
        s.reconcile_failure('scope')
        s.advance('SCOPED', 'scope')
        recovered = Supervisor(self.lease, Journal(self.root / 'journal.jsonl', binding()), self.evidence,
                               lambda _: True, self.validators)
        self.assertEqual(recovered.state, s.state)
        self.assertIsNone(recovered.failure)
        self.assertEqual(len(recovered.journal.events), 4)

    def test_failed_known_gate_blocks_next_transition_and_reload_until_explicit_repair(self):
        for status in ('FAILED', 'BLOCKED', 'REWORK'):
            with self.subTest(status=status):
                path = self.root / (status + '.journal')
                s = Supervisor(self.lease, Journal(path, binding()), self.evidence,
                               lambda _: self.match, self.validators)
                s.advance('SCOPED', 'scope'); s.fail(status, 'scope', 'failed-scope')
                recovered = Supervisor(self.lease, Journal(path, binding()), self.evidence,
                                       lambda _: self.match, self.validators)
                self.assertEqual(recovered.failure, s.failure)
                for controller in (s, recovered):
                    with self.assertRaises(Rejected): controller.advance('BUILT', 'build')
                    self.assertEqual(controller.state, 'SCOPED')
                self.receipts['repair-scope'] = receipt('scope', memory_first=True,
                    goal_lifecycle_verified=True, model='gpt-6.1-sol', effort='medium', repair_id=status)
                recovered.reconcile_failure('repair-scope')
                recovered = Supervisor(self.lease, Journal(path, binding()), self.evidence,
                                       lambda _: self.match, self.validators)
                self.assertIsNone(recovered.failure)
                recovered.advance('BUILT', 'build')
                self.assertEqual(recovered.state, 'BUILT')
                self.receipts['repair-scope']['memory_first'] = False
                with self.assertRaises(Rejected):
                    Supervisor(self.lease, Journal(path, binding()), self.evidence,
                               lambda _: self.match, self.validators)

    def test_reconciliation_rejects_reused_arbitrary_untrusted_and_wrong_bound_evidence(self):
        s = self.controller(); s.advance('SCOPED', 'scope')
        self.receipts['failed'] = receipt('scope', status='failed')
        s.fail('REWORK', 'scope', 'failed')
        original = receipt('scope', memory_first=True, goal_lifecycle_verified=True,
                           model='gpt-6.1-sol', effort='medium', repair_id='new')
        for ref in ('failed', 'scope', 'build', 'missing'):
            with self.subTest(ref=ref), self.assertRaises(Rejected): s.reconcile_failure(ref)
        self.receipts['alias'] = copy.deepcopy(self.receipts['scope'])
        with self.assertRaises(Rejected): s.reconcile_failure('alias')
        for change in ({'status': 'unverified'}, {'binding': {}}, {'kind': 'build'},
                       {'provenance': 'live'}, {'memory_first': False}):
            self.receipts['repair'] = {**original, **change}
            with self.subTest(change=change), self.assertRaises(Rejected): s.reconcile_failure('repair')
        self.receipts['repair'] = original
        self.validators['SCOPED'] = lambda _: False
        with self.assertRaises(Rejected): s.reconcile_failure('repair')
        self.validators['SCOPED'] = lambda _: True
        self.evidence.verifier = lambda *a: False
        with self.assertRaises(Rejected): s.reconcile_failure('repair')
        self.evidence.verifier = lambda *a: True
        self.match = False
        with self.assertRaises(Rejected): s.reconcile_failure('repair')
        self.match = True
        self.assertEqual(len(self.journal.events), 3)
        s.reconcile_failure('repair')
        self.assertIsNone(s.failure)
        self.receipts['repair']['repair_id'] = 'changed'
        with self.assertRaises(Rejected): self.controller()

    def test_multiple_failures_pending_and_invalid_gate_cannot_bypass_reconciliation(self):
        s = self.controller()
        for gate in ('arbitrary', 'GREEN', '', None):
            with self.subTest(gate=gate), self.assertRaises(Rejected): s.fail('REWORK', gate, 'raw')
        self.assertEqual(self.journal.events, [])
        self.journal.append({'type': 'begin', 'target': 'SCOPED', 'ref': 'scope'})
        s = self.controller(); s.fail('BLOCKED', 'scope', 'raw-one')
        s.fail('REWORK', 'build', 'raw-two')
        with self.assertRaises(Rejected): s.reconcile_pending()
        self.receipts['repair-build'] = receipt('build', allowed_paths_verified=True,
                                              authority_unchanged=True, repair_id='new')
        with self.assertRaises(Rejected): s.reconcile_failure('repair-build')
        self.validators['BUILT'] = lambda _: True
        s.reconcile_failure('repair-build')
        self.assertIsNotNone(s.failure)
        with self.assertRaises(Rejected): s.reconcile_pending()
        s = self.controller()
        self.assertEqual(s.failure['ref'], 'raw-one')
        s.reconcile_failure('scope'); s.reconcile_pending()
        self.assertEqual(s.state, 'SCOPED')

    def test_unittest_contradictory_multiple_malformed_error_summaries_rejected(self):
        from scripts.autonomous.supervisor import validate_test_commands
        bad_outputs = [
            'Ran 50 tests in 0s\nFAILED (failures=1)\n\nOK\n',
            'Ran 50 tests in 0s\nOK\nRan 50 tests in 0s\nOK\n',
            'Ran 50 tests in 0s\nOK\nOK\n',
            'Ran 50 tests in nonsense\nOK\n',
            'Ran 50 tests in 0.1s garbage\nOK\n',
            'Ran fifty tests in 0.1s\nOK\n',
            'ERROR: test_required\nRan 50 tests in 0.1s\nOK\n',
            'test_required ... FAIL\nRan 50 tests in 0.1s\nOK\n',
            'OK\nRan 50 tests in 0.1s\n',
        ]
        good_outputs = ['test_required (suite.Tests.test_required) ... ok\n\n'
                        '----------------------------------------------------------------------\n'
                        'Ran 1 test in 0.001s\n\nOK\n',
                        'Ran 50 tests in 1.230s\n\nOK\n']
        for output in bad_outputs + good_outputs:
            r = copy.deepcopy(self.receipts['test'])
            row = next(t for t in r['commands'] if 'unittest' in t['command'])
            row.update(output=output, output_sha256=hashlib.sha256(output.encode()).hexdigest())
            with self.subTest(output=output):
                if output in bad_outputs:
                    with self.assertRaises(Rejected): validate_test_commands(r, binding())
                else: validate_test_commands(r, binding())

    def test_reconciliation_failed_bytes_and_repaired_gate_reuse_denied(self):
        s = self.controller()
        self.receipts['failed'] = receipt('scope', memory_first=True, goal_lifecycle_verified=True,
                                         model='gpt-6.1-sol', effort='medium', repair_id='failed')
        s.fail('REWORK', 'scope', 'failed')
        self.receipts['alias-failed'] = copy.deepcopy(self.receipts['failed'])
        with self.assertRaises(Rejected): s.reconcile_failure('alias-failed')
        self.receipts['new-repair'] = {**self.receipts['failed'], 'repair_id': 'distinct'}
        s.reconcile_failure('new-repair')
        s.fail('REWORK', 'scope', 'second-failure')
        self.receipts['alias-repair'] = copy.deepcopy(self.receipts['new-repair'])
        for ref in ('new-repair', 'alias-repair'):
            with self.subTest(ref=ref), self.assertRaises(Rejected): s.reconcile_failure(ref)
        recovered = self.controller()
        self.assertEqual(recovered.failure['ref'], 'second-failure')
        self.receipts['second-repair'] = {**self.receipts['new-repair'], 'repair_id': 'second'}
        recovered.reconcile_failure('second-repair')
        recovered = self.controller()
        self.assertIsNone(recovered.failure)
        recovered.advance('SCOPED', 'second-repair')

    def test_reconciliation_journal_failure_association_revalidated_on_reload(self):
        from scripts.autonomous.review_host import canonical, digest
        s = self.controller(); s.fail('REWORK', 'scope', 'raw')
        s.reconcile_failure('scope')
        path = self.root / 'journal.jsonl'
        original = path.read_bytes()
        for field, value in [('failure_hash', '0'*64), ('receipt_sha256', '0'*64)]:
            rows = [__import__('json').loads(line) for line in original.splitlines()]
            rows[-1][field] = value
            rows[-1].pop('hash'); rows[-1]['hash'] = digest(rows[-1])
            path.write_bytes(b''.join(canonical(row) + b'\n' for row in rows))
            with self.subTest(field=field), self.assertRaises(Rejected):
                Supervisor(self.lease, Journal(path, binding()), self.evidence,
                           lambda _: True, self.validators)
        path.write_bytes(original)
        self.assertIsNone(self.controller().failure)
