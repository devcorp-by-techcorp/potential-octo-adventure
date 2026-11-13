import copy
import hashlib
import tempfile
import unittest
from dataclasses import asdict, replace
from pathlib import Path
from scripts.autonomous.protocol import Rejected
from scripts.autonomous.review_host import digest
from scripts.autonomous.gate import (Binding, Evidence, ACS, JOBS, review_gate, publication_gate,
    memory_write_gate, records_gate, reset_gate, compare_final_manifests, is_record)


def binding():
    return Binding('R0', 'a'*64, 'b'*40, 'c'*40, 'd'*64, 'e'*64, 'f'*64)


def receipt(kind, **kw):
    return {'kind': kind, 'status': 'pass', 'provenance': 'synthetic', 'binding': asdict(binding()), **kw}


def publication(commit='b'*40):
    return {'branch': 'codex/studio-suite-r0-supervision-20261008', 'commit': commit, 'remote_commit': commit,
            'overwrite': False, 'draft': True, 'pr_number': 19,
            'jobs': {k: {'head_sha': commit, 'status': 'completed', 'conclusion': 'success', 'url': 'synthetic://job'} for k in JOBS}}


def memory_write():
    payload = {'authorType': 'agent', 'mass': 1, 'tags': ['studio-suite_v2', 'work-history'],
               'data': {'session': {'runtime': 'codex', 'sessionId': 'verified-session'},
                        'git': {'branch': 'candidate', 'head': 'b'*40}}}
    return {'workspace': 'studio_suite_v2', 'workspace_verified': True,
            'writes': [{'id': 'memory-id', 'payload': payload, 'readback': copy.deepcopy(payload),
                        'metadata_authorized': True, 'metadata_verified': True,
                        'discoverable_session': payload['data']['session'], 'discoverable_git': payload['data']['git']}]}


def reset_facts(terminal=False):
    checkpoint = {'phase_id': 'C11-B' if terminal else 'R0', 'state': 'GREEN', 'final_commit': 'b'*40,
                  'next_phase_id': None if terminal else 'R0-C', 'terminal': terminal,
                  'required_goals_complete': terminal}
    compaction = {'thread_id': 'controller', 'completed': True, 'turn_id': 'turn', 'item_id': 'compact'}
    bootstrap = {'thread_id': 'fresh', 'empty_history': True, 'model': 'gpt-6.1-sol', 'effort': 'medium',
                 'memory_first': True, 'memory_readback': True, 'source_sha256': 'e'*64, 'final_commit': 'b'*40,
                 'prior_green_verified': True, 'git_ci_verified': True, 'records_verified': True,
                 'goal_ledger_verified': True, 'next_phase_id': checkpoint['next_phase_id'],
                 'full_completion_recorded_readback': terminal}
    return checkpoint, compaction, bootstrap


def review_fixture():
    r = {'phase_id': 'R0', 'contract_sha256': 'a'*64, 'candidate_commit': 'b'*40, 'candidate_tree': 'c'*40,
         'packet_sha256': 'd'*64, 'sandbox_receipt': 'sandbox', 'verdict': 'PASS',
         'criteria': [{'id': a, 'result': 'pass', 'evidence': ['acceptance']} for a in sorted(ACS)],
         'findings': [], 'independent_checks': ['synthetic command'], 'limitations': []}
    receipts = {'sandbox': receipt('sandbox', independent=True, instance='instance', thread_id='reviewer', review_receipt='review'),
                'review': receipt('outcome_review', fresh=True, result_sha256=digest(r), instance='instance',
                                  thread_id='reviewer', controller_thread_id='controller'),
                'acceptance': receipt('acceptance')}
    return r, receipts


class GateTests(unittest.TestCase):
    def test_independently_bound_review_positive_and_each_missing_ac(self):
        r, receipts = review_fixture()
        e = Evidence(binding(), receipts, lambda *a: True, synthetic=True)
        self.assertEqual(review_gate(r, binding(), e), digest(r))
        for ac in ACS:
            bad = copy.deepcopy(r); bad['criteria'] = [row for row in bad['criteria'] if row['id'] != ac]
            # Rebind independent signature to exercise AC validation, not only digest.
            receipts['review']['result_sha256'] = digest(bad)
            with self.subTest(ac=ac), self.assertRaises(Rejected): review_gate(bad, binding(), e)

    def test_material_candidate_source_evidence_and_packet_drift(self):
        r, receipts = review_fixture()
        for field in ('candidate_commit', 'candidate_tree', 'contract_sha256', 'packet_sha256', 'source_sha256', 'evidence_sha256'):
            old = getattr(binding(), field)
            b = replace(binding(), **{field: '0'*len(old)})
            e = Evidence(b, receipts, lambda *a: True, synthetic=True)
            with self.subTest(field=field), self.assertRaises(Rejected): review_gate(r, b, e)

    def test_reasoning_prior_verdict_missing_receipt_and_forged_pass(self):
        r, receipts = review_fixture()
        e = Evidence(binding(), receipts, lambda *a: True, synthetic=True)
        for field in ('analysis', 'hidden_reasoning', 'prior_verdict'):
            bad = copy.deepcopy(r); bad[field] = 'forbidden'
            with self.assertRaises(Rejected): review_gate(bad, binding(), e)
        receipts.pop('acceptance')
        with self.assertRaises(Rejected): review_gate(r, binding(), e)
        r, receipts = review_fixture()
        e = Evidence(binding(), receipts, lambda *a: False, synthetic=True)
        with self.assertRaises(Rejected): review_gate(r, binding(), e)
        e = Evidence(binding(), receipts, lambda *a: True)  # fixtures cannot pass LIVE
        with self.assertRaises(Rejected): review_gate(r, binding(), e)

    def test_unverified_ac_and_blocking_findings_even_signed_pass(self):
        for mutate in ('unverified', 'blocking', 'self_review'):
            r, receipts = review_fixture()
            if mutate == 'unverified': r['criteria'][0]['result'] = 'unverified'
            elif mutate == 'blocking':
                r['findings'] = [{'severity': 'blocking', 'requirement': 'AC-5', 'location': 'file:1',
                                  'reproduction': 'command', 'observed': 'defect', 'expected': 'no defect'}]
            else: receipts['review']['controller_thread_id'] = 'reviewer'
            receipts['review']['result_sha256'] = digest(r)
            with self.assertRaises(Rejected): review_gate(r, binding(), Evidence(binding(), receipts, lambda *a: True, synthetic=True))

    def test_ci_exact_head_all_jobs_remote_draft_and_no_overwrite(self):
        good = publication(); publication_gate(good, commit='b'*40, branch=good['branch'])
        mutations = [{'remote_commit': 'c'*40}, {'pr_number': 18}, {'draft': False}, {'overwrite': True},
                     {'branch': 'main'}]
        for change in mutations:
            r = copy.deepcopy(good); r.update(change)
            with self.assertRaises(Rejected): publication_gate(r, commit='b'*40, branch=r['branch'])
        for job in JOBS:
            for key, val in [('head_sha', 'c'*40), ('status', 'queued'), ('conclusion', 'failure')]:
                r = copy.deepcopy(good); r['jobs'][job][key] = val
                with self.assertRaises(Rejected): publication_gate(r, commit='b'*40, branch=r['branch'])
            r = copy.deepcopy(good); del r['jobs'][job]
            with self.assertRaises(Rejected): publication_gate(r, commit='b'*40, branch=r['branch'])

    def test_memory_full_readback_metadata_authorship_and_workspace(self):
        good = memory_write(); memory_write_gate(good)
        for field, value in [('id', None), ('readback', None), ('metadata_authorized', False),
                             ('metadata_verified', False), ('discoverable_session', {})]:
            r = copy.deepcopy(good); r['writes'][0][field] = value
            with self.assertRaises(Rejected): memory_write_gate(r)
        for field, value in [('authorType', 'user'), ('mass', 3), ('tags', [])]:
            r = copy.deepcopy(good); r['writes'][0]['payload'][field] = value
            r['writes'][0]['readback'] = copy.deepcopy(r['writes'][0]['payload'])
            with self.assertRaises(Rejected): memory_write_gate(r)
        r = copy.deepcopy(good); r['workspace'] = 'other'
        with self.assertRaises(Rejected): memory_write_gate(r)

    def test_records_only_changes_do_not_waive_executable_or_source_drift(self):
        reviewed = {p: {'sha256': h*64, 'mode': '100644'} for p, h in
                    [('app.py', 'a'), ('README.md', 'b'), ('docs/development/long-running-session-plan.md', 'c')]}
        self.assertEqual(compare_final_manifests(reviewed, {**reviewed, 'README.md': {'sha256': 'd'*64, 'mode': '100644'}}), {'README.md'})
        for path in ('app.py', 'docs/development/long-running-session-plan.md', '.github/workflows/ci.yml',
                     'docs/development/phases/R0/hidden.py', 'test_reports/artifacts/r0-2026-10-08/asset.js'):
            with self.subTest(path=path), self.assertRaises(Rejected): compare_final_manifests(reviewed, {**reviewed, path: 'new'})
        self.assertFalse(is_record('docs/development/phases/R0/execution-contract.md'))
        with self.assertRaises(Rejected): is_record('../README.md')

    def test_publication_missing_null_empty_and_malformed_sha_pins(self):
        good = publication()
        absent = copy.deepcopy(good)
        del absent['commit']; del absent['remote_commit']
        for job in absent['jobs'].values(): del job['head_sha']
        with self.assertRaises(Rejected): publication_gate(absent, commit=None, branch=good['branch'])
        for value in (None, '', 'b'*39, 'b'*41, 'B'*40, 123, 'g'*40):
            with self.subTest(value=value), self.assertRaises(Rejected):
                publication_gate(publication(value), commit=value, branch=good['branch'])
            for field in ('commit', 'remote_commit'):
                bad = copy.deepcopy(good); bad[field] = value
                with self.subTest(field=field, value=value), self.assertRaises(Rejected):
                    publication_gate(bad, commit='b'*40, branch=good['branch'])
            for name in JOBS:
                bad = copy.deepcopy(good); bad['jobs'][name]['head_sha'] = value
                with self.subTest(job=name, value=value), self.assertRaises(Rejected):
                    publication_gate(bad, commit='b'*40, branch=good['branch'])
        for field in ('commit', 'remote_commit'):
            bad = copy.deepcopy(good); del bad[field]
            with self.assertRaises(Rejected): publication_gate(bad, commit='b'*40, branch=good['branch'])
        for name in JOBS:
            bad = copy.deepcopy(good); del bad['jobs'][name]['head_sha']
            with self.assertRaises(Rejected): publication_gate(bad, commit='b'*40, branch=good['branch'])

    def test_records_require_nonexecutable_regular_mode_on_both_sides(self):
        good = {'README.md': {'sha256': 'a'*64, 'mode': '100644'}}
        for mode in ('100755', '120000', '160000', '040000', '', None):
            for side in ('reviewed', 'final'):
                bad = {'README.md': {'sha256': 'a'*64, 'mode': mode}}
                with self.subTest(mode=mode, side=side), self.assertRaises(Rejected):
                    compare_final_manifests(bad if side == 'reviewed' else good,
                                            bad if side == 'final' else good)
        for entry in ('raw digest', {'sha256': 'a'*64}, {'sha256': 'bad', 'mode': '100644'}):
            with self.assertRaises(Rejected): compare_final_manifests(good, {'README.md': entry})
        self.assertEqual(compare_final_manifests({}, good), {'README.md'})
        self.assertEqual(compare_final_manifests(good, {}), {'README.md'})

    def test_manifest_association_without_self_hash_and_byte_drift(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, 'app.py').write_text('app'); Path(d, 'README.md').write_text('records')
            exe = {'app.py': hashlib.sha256(b'app').hexdigest()}
            rec = {'README.md': hashlib.sha256(b'records').hexdigest()}
            r = {'commit': 'b'*40, 'executable_sha256': digest(exe), 'records_sha256': digest(rec)}
            records_gate(d, exe, rec, exe, rec, r, final_commit='b'*40)
            Path(d, 'app.py').write_text('unreviewed')
            with self.assertRaises(Rejected): records_gate(d, exe, rec, exe, rec, r, final_commit='b'*40)

    def test_reset_and_terminal_success_explicitly_synthetic(self):
        for terminal in (False, True):
            c, comp, boot = reset_facts(terminal)
            self.assertTrue(reset_gate(c, comp, boot, controller_thread_id='controller', final_commit='b'*40, source_sha256='e'*64))

    def test_reset_every_missing_bootstrap_check_and_wrong_actual_thread(self):
        c, comp, boot = reset_facts()
        for field in ('memory_first', 'memory_readback', 'prior_green_verified', 'git_ci_verified', 'records_verified', 'goal_ledger_verified', 'empty_history'):
            bad = copy.deepcopy(boot); bad[field] = False
            with self.subTest(field=field), self.assertRaises(Rejected): reset_gate(c, comp, bad, controller_thread_id='controller', final_commit='b'*40, source_sha256='e'*64)
        for field, value in [('source_sha256', '0'*64), ('thread_id', 'controller'), ('final_commit', '0'*40)]:
            bad = copy.deepcopy(boot); bad[field] = value
            with self.assertRaises(Rejected): reset_gate(c, comp, bad, controller_thread_id='controller', final_commit='b'*40, source_sha256='e'*64)
        comp['thread_id'] = 'marker'
        with self.assertRaises(Rejected): reset_gate(c, comp, boot, controller_thread_id='controller', final_commit='b'*40, source_sha256='e'*64)

    def test_terminal_blocked_partial_null_next_and_failed_close_denied(self):
        for change in ({'phase_id': 'R0'}, {'required_goals_complete': False}, {'partial': True}, {'blocked_goals': ['C4']}):
            c, comp, boot = reset_facts(True); c.update(change)
            with self.assertRaises(Rejected): reset_gate(c, comp, boot, controller_thread_id='controller', final_commit='b'*40, source_sha256='e'*64)
        c, comp, boot = reset_facts(True); boot['full_completion_recorded_readback'] = False
        with self.assertRaises(Rejected): reset_gate(c, comp, boot, controller_thread_id='controller', final_commit='b'*40, source_sha256='e'*64)
        c, comp, boot = reset_facts(); c['next_phase_id'] = None; boot['next_phase_id'] = None
        with self.assertRaises(Rejected): reset_gate(c, comp, boot, controller_thread_id='controller', final_commit='b'*40, source_sha256='e'*64)

    def test_records_acceptance_actual_chmod_symlink_and_allowlist(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / 'app.py').write_text('app')
            record = root / 'README.md'; record.write_text('records'); record.chmod(0o644)
            exe = {'app.py': hashlib.sha256(b'app').hexdigest()}
            rec = {'README.md': hashlib.sha256(b'records').hexdigest()}
            def accept(records=rec):
                r = {'commit': 'b'*40, 'executable_sha256': digest(exe),
                     'records_sha256': digest(records)}
                return records_gate(root, exe, records, exe, records, r, final_commit='b'*40)
            accept()
            for mode in (0o755, 0o654, 0o645):
                record.chmod(mode)
                self.assertEqual(hashlib.sha256(record.read_bytes()).hexdigest(), rec['README.md'])
                with self.subTest(mode=mode), self.assertRaises(Rejected): accept()
            record.chmod(0o644); accept()
            record.rename(root / 'target.txt'); record.symlink_to(root / 'target.txt')
            with self.assertRaises((Rejected, OSError)): accept()
            record.unlink(); record.write_text('records'); record.chmod(0o644)
            nested = root / 'docs/development/phases/R0'; nested.mkdir(parents=True)
            (nested / 'notes.txt').write_text('records')
            nested_rec = {'docs/development/phases/R0/notes.txt': rec['README.md']}
            accept(nested_rec)
            nested.rename(root / 'real-records'); nested.symlink_to(root / 'real-records', target_is_directory=True)
            with self.assertRaises((Rejected, OSError)): accept(nested_rec)
            (root / 'unallowlisted.txt').write_text('records')
            with self.assertRaises(Rejected): accept({'unallowlisted.txt': rec['README.md']})
            record.write_text('byte drift')
            with self.assertRaises(Rejected): accept()
