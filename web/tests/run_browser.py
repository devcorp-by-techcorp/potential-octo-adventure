"""Start isolated fixtures, run all browser suites, and always clean up processes."""

import json
import os
import signal
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen

from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[2]


def wait_ready(url, process, database=False):
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("Browser fixture exited before becoming ready")
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200 and (
                    not database or json.load(response).get("ok")
                ):
                    return
        except OSError:
            pass
        time.sleep(0.2)
    raise RuntimeError("Browser fixture did not become ready")


def stop_process(process):
    if process.poll() is not None:
        return
    os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def start_backend(logs, storage_root):
    return subprocess.Popen(
        [sys.executable, "backend/tests/browser_server.py"],
        cwd=ROOT,
        env={
            **os.environ,
            "DOCUMENT_STORAGE_BACKEND": "local",
            "DOCUMENT_STORAGE_LOCAL_ROOT": storage_root,
        },
        stdout=logs,
        stderr=logs,
        start_new_session=True,
    )


def main():
    mongo_uri = os.environ.get("BROWSER_MONGODB_URI")
    if not mongo_uri:
        raise RuntimeError(
            "Set BROWSER_MONGODB_URI to a local test MongoDB; never a production database"
        )
    for port in (8000, 5173):
        with socket.socket() as probe:
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                raise RuntimeError(
                    f"Port {port} is in use; stop existing servers before browser tests"
                )
    if not (ROOT / "web/build/index.html").is_file():
        raise RuntimeError("Build the production workspace before browser verification")
    processes = []
    with (
        tempfile.TemporaryFile(mode="w+") as logs,
        tempfile.TemporaryDirectory(prefix="studio-documents-") as storage_root,
    ):
        try:
            processes.append(start_backend(logs, storage_root))
            wait_ready(
                "http://127.0.0.1:8000/api/health/db", processes[-1], database=True
            )
            with MongoClient(mongo_uri) as mongo:
                staff_fixture = mongo["studio_suite_browser_test"].staff_identities.find_one(
                    {"_id": "browser-staff"}
                )
            if staff_fixture is None:
                raise RuntimeError("Browser fixture did not seed its staff identity")
            environment = {**os.environ, "VITE_BACKEND_URL": "", "PORT": "5173"}
            processes.append(
                subprocess.Popen(
                    ["node", str(next(p for p in (ROOT / "web/node_modules/vite/bin/vite.js", ROOT / "node_modules/vite/bin/vite.js") if p.is_file())), "preview",
                     "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
                    cwd=ROOT / "web",
                    env=environment,
                    stdout=logs,
                    stderr=logs,
                    start_new_session=True,
                )
            )
            wait_ready("http://127.0.0.1:5173", processes[-1])
            suites = (
                "entry_page.py",
                "studio_auth.py",
                "studio_inbox.py",
                "client_invitations.py",
                "studio_bookings.py",
                "studio_reporting.py",
                "booking_drafts.py",
                "conversations.py",
                "studio_contacts.py",
                "public_content.py",
                "enquiry_operations.py",
                "documents.py",
                "account_sessions.py",
                "booking_resources.py",
            )
            requested = os.environ.get("BROWSER_SUITES")
            if requested:
                selected = {name.strip() for name in requested.split(",")}
                if not selected.issubset(suites):
                    raise ValueError("BROWSER_SUITES contains an unknown suite")
                suites = tuple(name for name in suites if name in selected)
            for suite in suites:
                print(f"Running browser suite: {suite}", flush=True)
                if suite in {"client_invitations.py", "studio_bookings.py"}:
                    # These independent public-submission journeys use fresh
                    # process-local rate-limit budgets and a clean test database.
                    stop_process(processes[0])
                    processes[0] = start_backend(logs, storage_root)
                    wait_ready(
                        "http://127.0.0.1:8000/api/health/db",
                        processes[0],
                        database=True,
                    )
                    with MongoClient(mongo_uri) as mongo:
                        staff_fixture = mongo["studio_suite_browser_test"].staff_identities.find_one(
                            {"_id": "browser-staff"}
                        )
                with MongoClient(mongo_uri) as mongo:
                    mongo.drop_database("studio_suite_browser_test")
                    mongo["studio_suite_browser_test"].staff_identities.insert_one(
                        staff_fixture
                    )
                subprocess.run(
                    [sys.executable, str(ROOT / "web/tests" / suite)],
                    cwd=ROOT,
                    env={**os.environ, "ENTRY_TEST_URL": "http://127.0.0.1:5173"},
                    check=True,
                )
            print(f"All {len(suites)} browser suites passed", flush=True)
        except Exception:
            logs.seek(0)
            print(logs.read(), file=sys.stderr)
            raise
        finally:
            for process in reversed(processes):
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                if process.poll() is None:
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        try:
                            os.killpg(process.pid, signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                        process.wait()
            with MongoClient(mongo_uri) as mongo:
                mongo.drop_database("studio_suite_browser_test")


if __name__ == "__main__":
    main()
