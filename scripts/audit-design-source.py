"""Inventory the authoritative local _ds bytes without extracting or executing them."""

import argparse
import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "_ds"
OUTPUT = ROOT / "docs/development/design-system-source-manifest.json"


def digest(value):
    return hashlib.sha256(value).hexdigest()


def role(path):
    if path.endswith(".zip"):
        return "preserved source archive"
    if "/assets/" in path or "/branding/" in path or "/screenshots/" in path:
        return "reference asset or historical screenshot"
    if path.endswith(".md"):
        return "requirements or historical handoff"
    if "/tokens/" in path or path.endswith("scripts/tokens.ts"):
        return "design token contract"
    if "/state/" in path or "/data/" in path:
        return "prototype data or state; not application persistence"
    if "Probe" in path or "E2E" in path or "Parity-Audit" in path:
        return "prototype verification; not shipped-app evidence"
    if path.endswith(("support.js", "doc-page.js")):
        return "prototype document runtime"
    return "design reference implementation"


def inventory():
    files = []
    archives = []
    for path in sorted(SOURCE.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT).as_posix()
        content = path.read_bytes()
        files.append({"path": relative, "bytes": len(content), "sha256": digest(content), "role": role(relative)})
        if path.suffix != ".zip":
            continue
        with zipfile.ZipFile(path) as archive:
            failure = archive.testzip()
            if failure:
                raise ValueError(f"Invalid archive CRC: {relative}!{failure}")
            members = []
            for member in archive.infolist():
                if member.is_dir():
                    continue
                data = archive.read(member)
                extracted = SOURCE / member.filename
                state = "archive_only"
                if extracted.is_file():
                    state = "identical" if extracted.read_bytes() == data else "local_override"
                members.append({"path": member.filename, "bytes": len(data), "sha256": digest(data), "crc32": f"{member.CRC:08x}", "local_state": state, "role": role(member.filename)})
            archives.append({"path": relative, "crc_valid": True, "members": members})
    if not files:
        raise ValueError("Authoritative _ds directory is empty or absent")
    return {"schema_version": 1, "source": "_ds (local source of truth)", "files": files, "archives": archives}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Refresh the reviewed manifest after source changes")
    args = parser.parse_args()
    value = inventory()
    if args.write:
        OUTPUT.write_text(json.dumps(value, indent=2) + "\n")
    elif not OUTPUT.is_file() or json.loads(OUTPUT.read_text()) != value:
        raise SystemExit("Design source manifest drift: inspect changes, then run --write after review")
    print(f"design-source: {len(value['files'])} files, {sum(len(a['members']) for a in value['archives'])} archive files; SHA-256 manifest matches, archive CRCs valid")
    for archive in value["archives"]:
        states = {}
        for member in archive["members"]:
            state = member["local_state"]
            states[state] = states.get(state, 0) + 1
        print(f"{archive['path']}: {states}")
    print("This verifies source integrity only; it does not establish application compliance.")


if __name__ == "__main__":
    main()
