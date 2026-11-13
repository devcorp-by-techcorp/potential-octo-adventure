import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from scripts.autonomous.protocol import Rejected
from scripts.autonomous.review_host import (build_packet, verify_manifest, FixedBroker,
    HOST_CHECKS, validate_host_receipt, inspect_effective_host)


class PacketTests(unittest.TestCase):
    def test_metadata_nested_allowlist_and_normalized_prohibited_spellings(self):
        for field in ('hiddenReasoning', 'hidden_reasoning', 'hidden-reasoning', 'HiddenReasoning',
                      'chainOfThought', 'builderHistory', 'priorVerdict', 'compactedContext'):
            for metadata in ({'environment': {field: 'leak'}},
                             {'environment': {'limitations': [{field: 'leak'}]}}):
                with self.subTest(field=field, metadata=metadata), self.assertRaises(Rejected):
                    build_packet(self.root, **self.kw, metadata=metadata)
        for metadata in ({'environment': {'unknown': 'leak'}},
                         {'environment': {'os': {'arbitrary': 'leak'}}},
                         {'limitations': {'arbitrary': 'leak'}}):
            with self.assertRaises(Rejected): build_packet(self.root, **self.kw, metadata=metadata)
        packet, _ = build_packet(self.root, **self.kw, metadata={
            'environment': {'os': 'Linux', 'provenance': 'synthetic', 'limitations': ['not live']},
            'delivered_behavior': 'Reject hiddenReasoning fields; source prose remains legitimate.'})
        self.assertIn('reasoning', packet['files']['authority']['authority.md'])

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.root.joinpath('authority.md').write_text('Source forbids analysis, reasoning and transcripts; source text remains valid.')
        self.root.joinpath('candidate.py').write_text('print("candidate")')
        self.root.joinpath('raw.txt').write_text('command: unittest; exit: 0')
        self.pins = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in self.root.iterdir()}
        self.kw = dict(allowlist=set(self.pins), base={'candidate.py': self.pins['candidate.py']},
                       candidate={'candidate.py': self.pins['candidate.py']}, authority={'authority.md': self.pins['authority.md']},
                       evidence={'raw.txt': self.pins['raw.txt']}, binding={'phase_id': 'R0', 'contract_sha256': 'a'*64,
                       'candidate_commit': 'b'*40, 'candidate_tree': 'c'*40})

    def test_deterministic_packet_authority_words_legitimate(self):
        p, sha = build_packet(self.root, **self.kw)
        self.assertEqual((p, sha), build_packet(self.root, **self.kw))
        self.assertIn('reasoning', p['files']['authority']['authority.md'])

    def test_base_and_candidate_separate_bytes(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, 'candidate.py').write_text('old')
            self.kw['base'] = {'candidate.py': hashlib.sha256(b'old').hexdigest()}
            p, _ = build_packet(self.root, **self.kw, base_root=d)
            self.assertEqual(p['files']['base']['candidate.py'], 'old')
            self.assertNotEqual(p['files']['base'], p['files']['candidate'])

    def test_every_manifest_drift_rejected(self):
        for path in ('candidate.py', 'authority.md', 'raw.txt'):
            p = self.root / path; original = p.read_bytes(); p.write_bytes(original + b'changed')
            with self.subTest(path=path), self.assertRaises(Rejected): build_packet(self.root, **self.kw)
            p.write_bytes(original)

    def test_hostile_fields_nested_and_untrusted_paths(self):
        for metadata in [{'analysis': 'leak'}, {'environment': {'chain-of-thought': 'leak'}},
                         {'prior_verdict': 'PASS'}, {'rationale': 'persuasion'}]:
            with self.subTest(metadata=metadata), self.assertRaises(Rejected):
                build_packet(self.root, **self.kw, metadata=metadata)
        for path in ('../secret', '/etc/passwd', '.codex/history', 'transcript.txt', 'review-result.txt', 'a/../b'):
            kw = copy.deepcopy(self.kw); kw['allowlist'].add(path); kw['candidate'] = {path: 'a'*64}
            with self.subTest(path=path), self.assertRaises(Rejected): build_packet(self.root, **kw)
        kw = copy.deepcopy(self.kw); kw['allowlist'].remove('raw.txt')
        with self.assertRaises(Rejected): build_packet(self.root, **kw)

    def test_symlink_file_and_parent_rejected_without_reading_target(self):
        (self.root / 'link').symlink_to('/etc/passwd')
        with self.assertRaises(OSError): verify_manifest(self.root, {'link': 'a'*64})
        (self.root / 'dir').symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(OSError): verify_manifest(self.root, {'dir/raw.txt': self.pins['raw.txt']})

    def test_fixed_broker_extra_fields_and_same_instance(self):
        broker = FixedBroker('instance', 'thread', {'integrity': lambda: {'unchanged': True}})
        r = broker.call({'probe': 'integrity', 'challenge': 'safe_ascii-1'})
        self.assertEqual(r['instance'], 'instance')
        self.assertEqual(r['thread_id'], 'thread')
        for args in [{'probe': 'integrity', 'challenge': 'x', 'path': '/secret'},
                     {'probe': 'write', 'challenge': 'x'}, {'probe': 'integrity', 'challenge': 'spaces denied'}]:
            with self.assertRaises(Rejected): broker.call(args)

    def test_every_mandatory_host_check_and_live_instance_binding(self):
        r = {'instance': 'i', 'thread_id': 't', 'packet_sha256': 'p', 'challenge': 'c', 'provenance': 'live',
             'model': 'gpt-6.1-sol', 'effort': 'medium', 'checks': {c: 'pass' for c in HOST_CHECKS}, 'raw_evidence': ['probe']}
        kwargs = dict(instance='i', thread_id='t', packet_sha256='p', challenge='c', verify=lambda _: True)
        validate_host_receipt(r, **kwargs)
        for key in HOST_CHECKS:
            bad = copy.deepcopy(r); bad['checks'][key] = 'unverified'
            with self.subTest(check=key), self.assertRaises(Rejected): validate_host_receipt(bad, **kwargs)
        for key in ('instance', 'thread_id', 'packet_sha256', 'challenge', 'provenance', 'effort'):
            bad = copy.deepcopy(r); bad[key] = 'wrong'
            with self.assertRaises(Rejected): validate_host_receipt(bad, **kwargs)
        kwargs['verify'] = lambda _: False
        with self.assertRaises(Rejected): validate_host_receipt(r, **kwargs)

    def test_effective_configuration_uses_actual_read_apis_no_mutation(self):
        class API:
            calls = []
            def request(self, method, params, timeout):
                self.calls.append(method)
                return {'facts': 'fixture'}
        c = API()
        self.assertTrue(inspect_effective_host(c, '/source', verify_configuration=lambda *args: True)['verified'])
        self.assertEqual(c.calls, ['config/read', 'experimentalFeature/list', 'permissionProfile/list'])
        with self.assertRaises(Rejected): inspect_effective_host(c, '/source', verify_configuration=lambda *args: False)

    def test_structured_evidence_recursive_prohibited_fields_and_malformed_json(self):
        def packet(content, name='raw.json'):
            (self.root / name).write_text(content)
            kw = copy.deepcopy(self.kw)
            kw['allowlist'].add(name)
            kw['evidence'] = {name: hashlib.sha256(content.encode()).hexdigest()}
            return build_packet(self.root, **kw)
        for field in ('priorVerdict', 'hiddenReasoning', 'prior_verdict', 'Hidden-Reasoning',
                      'chainOfThought', 'builderHistory'):
            content = json.dumps({'data': [{'nested': {field: 'synthetic prohibited'}}]})
            for name in ('raw.json', 'raw.txt'):
                with self.subTest(field=field, name=name), self.assertRaises(Rejected):
                    packet(content, name)
        for content in ('{', '[{"data":', 'not JSON', '{"data":1} trailing',
                        '{"x":NaN}', '{"x":1,"x":2}', '"scalar"', 'null'):
            with self.subTest(content=content), self.assertRaises(Rejected): packet(content)
        valid = json.dumps({'checks': [{'name': 'Reject hiddenReasoning and priorVerdict fields',
                                      'status': 'pass'}], 'provenance': 'synthetic'})
        for name in ('raw.json', 'raw.txt'):
            result, sha = packet(valid, name)
            self.assertEqual(result['files']['evidence'][name], valid)
            self.assertEqual((result, sha), packet(valid, name))
        # Structured source authority is not an evidence payload; forbidden
        # field examples in source are legitimate, including JSON examples.
        authority = '{"hiddenReasoning":"Do not export this field"}'
        (self.root / 'authority.md').write_text(authority)
        self.kw['authority']['authority.md'] = hashlib.sha256(authority.encode()).hexdigest()
        self.root.joinpath('raw.txt').write_text('legitimate prose mentions priorVerdict and hiddenReasoning')
        self.kw['evidence']['raw.txt'] = hashlib.sha256(self.root.joinpath('raw.txt').read_bytes()).hexdigest()
        result, _ = build_packet(self.root, **self.kw)
        self.assertEqual(result['files']['authority']['authority.md'], authority)
