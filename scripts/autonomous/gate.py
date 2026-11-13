"""Fail-closed evidence gates. External host supplies independently checked facts.

Receipt verification is a trust boundary, not a builder-supplied PASS string.
Synthetic facts are accepted only in explicit disposable qualification mode.
"""
from dataclasses import dataclass, asdict
import re
from .protocol import require
from .review_host import check_fields, digest, verify_manifest

ACS = frozenset('AC-' + str(i) for i in range(1, 12))
JOBS = frozenset({'backend', 'web', 'production-web', 'infrastructure'})


@dataclass(frozen=True)
class Binding:
    phase_id: str
    contract_sha256: str
    candidate_commit: str
    candidate_tree: str
    packet_sha256: str
    source_sha256: str
    evidence_sha256: str

    def __post_init__(self):
        require(bool(self.phase_id), 'phase missing')
        for key, value in asdict(self).items():
            if key != 'phase_id':
                n = 40 if key in ('candidate_commit', 'candidate_tree') else 64
                require(isinstance(value, str) and re.fullmatch('[0-9a-f]{' + str(n) + '}', value), 'invalid binding')


class Evidence:
    def __init__(self, binding, receipts, verifier, *, synthetic=False):
        self.binding, self.receipts, self.verifier, self.synthetic = binding, receipts, verifier, synthetic

    def get(self, ref, kind):
        require(isinstance(ref, str) and ref in self.receipts, 'missing receipt')
        receipt = self.receipts[ref]
        check_fields(receipt)
        require(self.verifier(ref, receipt) is True, 'untrusted receipt')
        require(receipt.get('binding') == asdict(self.binding), 'receipt binding drift')
        require(receipt.get('kind') == kind and receipt.get('status') == 'pass', 'wrong/incomplete receipt')
        require(receipt.get('provenance') == ('synthetic' if self.synthetic else 'live'), 'provenance mismatch')
        return receipt


def review_gate(result, binding, evidence, *, stage='outcome'):
    expected = {'phase_id', 'contract_sha256', 'candidate_commit', 'candidate_tree', 'packet_sha256',
                'sandbox_receipt', 'verdict', 'criteria', 'findings', 'independent_checks', 'limitations'}
    check_fields(result)
    require(set(result) == expected, 'review result fields')
    for key in ('phase_id', 'contract_sha256', 'candidate_commit', 'candidate_tree', 'packet_sha256'):
        require(result[key] == getattr(binding, key), 'review candidate/contract drift')
    require(result['verdict'] == 'PASS', 'review not passed')
    sandbox = evidence.get(result['sandbox_receipt'], 'sandbox')
    require(sandbox.get('independent') is True and sandbox.get('instance') and sandbox.get('thread_id'), 'review isolation missing')
    reviewer = evidence.get(sandbox.get('review_receipt'), stage + '_review')
    require(reviewer.get('result_sha256') == digest(result) and reviewer.get('instance') == sandbox['instance'] and
            reviewer.get('thread_id') == sandbox['thread_id'] and reviewer.get('fresh') is True,
            'independent result/instance binding missing')
    require(reviewer.get('controller_thread_id') != reviewer.get('thread_id'), 'controller self-review')
    rows = result['criteria']
    require(isinstance(rows, list) and len(rows) == len(ACS) and
            {r.get('id') for r in rows} == ACS, 'mandatory AC missing/duplicate')
    for row in rows:
        require(set(row) == {'id', 'result', 'evidence'} and row['result'] == 'pass' and row['evidence'], 'unverified mandatory AC')
        for ref in row['evidence']:
            evidence.get(ref, 'acceptance')
    require(isinstance(result['findings'], list), 'malformed findings')
    for finding in result['findings']:
        require(set(finding) == {'severity', 'requirement', 'location', 'reproduction', 'observed', 'expected'}, 'finding fields')
        require(finding['severity'] == 'advisory', 'unresolved blocking finding')
    require(result['independent_checks'], 'independent checks missing')
    return digest(result)


def publication_gate(receipt, *, commit, branch):
    def pinned(value):
        return isinstance(value, str) and re.fullmatch('[0-9a-f]{40}', value) is not None
    require(pinned(commit) and pinned(receipt.get('commit')) and
            pinned(receipt.get('remote_commit')), 'publication SHA pins missing/malformed')
    require(receipt.get('branch') == branch and branch == 'codex/studio-suite-r0-supervision-20261008', 'wrong publication branch')
    require(receipt.get('commit') == commit and receipt.get('remote_commit') == commit, 'remote mismatch')
    require(receipt.get('overwrite') is False and receipt.get('draft') is True and
            type(receipt.get('pr_number')) is int and receipt['pr_number'] != 18, 'publication authority/PR')
    jobs = receipt.get('jobs', {})
    require(set(jobs) == JOBS, 'required CI jobs missing')
    for job in jobs.values():
        require(pinned(job.get('head_sha')) and job.get('head_sha') == commit and job.get('status') == 'completed' and
                job.get('conclusion') == 'success' and job.get('url'), 'CI pending/failed/wrong head')


def memory_write_gate(receipt):
    require(receipt.get('workspace') == 'studio_suite_v2' and receipt.get('workspace_verified') is True, 'workspace unverified')
    writes = receipt.get('writes')
    require(isinstance(writes, list) and writes, 'memory writes missing')
    for write in writes:
        require(write.get('id') and write.get('readback') == write.get('payload') and write.get('payload'), 'memory readback missing/mismatch')
        p = write['payload']
        require(p.get('authorType') == 'agent' and p.get('mass') == 1 and
                {'studio-suite_v2', 'work-history'} <= set(p.get('tags', [])), 'coding memory authorship/tags/mass')
        require(write.get('metadata_authorized') is True and write.get('metadata_verified') is True, 'trace metadata authority missing')
        data = p.get('data', {})
        # Metadata discoverability inventory is independently verified by host.
        require(data.get('session') == write.get('discoverable_session') and
                data.get('git') == write.get('discoverable_git'), 'invented/omitted discoverable metadata')


def records_gate(root, executable, records, reviewed_executable, reviewed_records, receipt, *, final_commit):
    require(executable == reviewed_executable and records == reviewed_records, 'unreviewed manifest changes')
    exec_hash = verify_manifest(root, executable)
    require(all(is_record(path) for path in records), 'unallowlisted records path')
    record_hash = verify_manifest(root, records, non_executable=True)
    require(not set(executable) & set(records), 'records overlap executable authority')
    require(receipt.get('commit') == final_commit and receipt.get('executable_sha256') == exec_hash and
            receipt.get('records_sha256') == record_hash, 'final manifest/commit association')
    # Receipt lives externally, never embeds its own hash in either manifest.
    return {'executable_sha256': exec_hash, 'records_sha256': record_hash}


def reset_gate(checkpoint, compaction, bootstrap, *, controller_thread_id, final_commit, source_sha256):
    require(checkpoint.get('state') == 'GREEN' and checkpoint.get('final_commit') == final_commit, 'not a GREEN checkpoint')
    require(compaction.get('thread_id') == controller_thread_id and compaction.get('completed') is True and
            compaction.get('item_id') and compaction.get('turn_id'), 'actual phase controller not compacted')
    require(bootstrap.get('thread_id') and bootstrap['thread_id'] != controller_thread_id and
            bootstrap.get('empty_history') is True and bootstrap.get('model') == 'gpt-6.1-sol' and
            bootstrap.get('effort') == 'medium', 'bootstrap not fresh medium')
    require(bootstrap.get('memory_first') is True and bootstrap.get('memory_readback') is True and
            bootstrap.get('source_sha256') == source_sha256 and bootstrap.get('final_commit') == final_commit and
            bootstrap.get('prior_green_verified') is True and bootstrap.get('git_ci_verified') is True and
            bootstrap.get('records_verified') is True and bootstrap.get('goal_ledger_verified') is True,
            'bootstrap evidence missing/stale')
    require(bootstrap.get('next_phase_id') == checkpoint.get('next_phase_id'), 'next contract mismatch')
    if checkpoint.get('terminal'):
        require(checkpoint.get('phase_id') == 'C11-B' and checkpoint.get('next_phase_id') is None and
                checkpoint.get('required_goals_complete') is True and
                bootstrap.get('full_completion_recorded_readback') is True, 'terminal completion unproven')
    else:
        require(checkpoint.get('next_phase_id') is not None, 'null next is not completion')
    require(checkpoint.get('partial') is not True and checkpoint.get('blocked_goals', []) == [], 'blocked required goals')
    return True

IMPLEMENTATION_PATHS = frozenset({'scripts/autonomous/' + p for p in (
    '__init__.py', 'protocol.py', 'review_host.py', 'gate.py', 'supervisor.py',
    'tests/__init__.py', 'tests/test_protocol.py', 'tests/test_review_host.py',
    'tests/test_gate.py', 'tests/test_supervisor.py')} | {'.github/workflows/ci.yml'})
RECORD_FILES = frozenset({'README.md', 'goals/GOALS.md', 'docs/development/session-handoff.md',
    'docs/development/next-session-prompt.md', 'docs/development/feature-status.md',
    'docs/development/design-system-compliance-audit.md', 'docs/development/decisions.md',
    'test_reports/2026-10-08-r0-bootstrap.md'})
AUTHORITY_FILES = frozenset({'docs/development/long-running-session-plan.md',
    'docs/development/readiness-assessment-2026-10-07.md',
    'docs/development/design-system-source-manifest.json',
    'docs/development/phases/R0/execution-contract.md'})


def is_record(path):
    from pathlib import PurePosixPath
    p = PurePosixPath(path)
    require(not p.is_absolute() and '..' not in p.parts, 'unsafe records path')
    if path in AUTHORITY_FILES:
        return False
    allowed = path in RECORD_FILES or path.startswith('docs/development/phases/R0/') or path.startswith('test_reports/artifacts/r0-2026-10-08/')
    # Records cannot conceal executables, generated assets or tests.
    return allowed and p.suffix.lower() in {'.md', '.json', '.txt', '.log', '.csv'}


def compare_final_manifests(reviewed, final):
    """Both maps must cover the ENTIRE tracked tree, not only changed scripts."""
    changed = {p for p in set(reviewed) | set(final) if reviewed.get(p) != final.get(p)}
    require(all(is_record(p) for p in changed), 'executable/source/config/dependency/authority drift')
    for path in changed:
        for manifest in (reviewed, final):
            if path in manifest:
                entry = manifest[path]
                require(isinstance(entry, dict) and set(entry) == {'sha256', 'mode'} and
                        entry['mode'] == '100644' and isinstance(entry['sha256'], str) and
                        re.fullmatch('[0-9a-f]{64}', entry['sha256']),
                        'records must be non-executable regular blobs')
    return changed


def freeze_git_tree(root, commit, *, git='/usr/bin/git'):
    """Host freezes full tracked tree from a real commit, excluding no authority.

    SHA256 blob bytes rather than Git object SHA; records split separately. No
    commit messages, history or symlink targets are read into review packets.
    """
    import hashlib
    import subprocess
    require(re.fullmatch('[0-9a-f]{40}', commit or ''), 'full commit required')
    entries = subprocess.check_output([git, '-C', str(root), 'ls-tree', '-rz', '--full-tree', commit], timeout=30)
    manifest = {}
    for entry in entries.split(b'\0'):
        if not entry:
            continue
        meta, path = entry.split(b'\t', 1)
        mode, typ, oid = meta.split()
        require(typ == b'blob' and mode in (b'100644', b'100755'), 'symlink/submodule needs scoped review')
        path = path.decode('utf-8')
        data = subprocess.check_output([git, '-C', str(root), 'cat-file', 'blob', oid.decode()], timeout=30)
        manifest[path] = {'sha256': hashlib.sha256(data).hexdigest(), 'mode': mode.decode()}
    require(manifest, 'empty Git tree')
    return manifest
