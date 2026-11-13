"""Smoke-test production Caddy routing locally or against a built Docker image.

Local: CADDY_BINARY=/path/to/caddy python web/tests/production_server.py
CI: python web/tests/production_server.py --image studio-suite-web:test
Uses an isolated fake upstream; no real identities, providers or database.
"""

import argparse
import http.client
import json
import os
import socket
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class Upstream(BaseHTTPRequestHandler):
    def do_GET(self):
        status = 503 if self.path == "/api/unavailable" else 200
        body = json.dumps({
            "path": self.path,
            "cookie": self.headers.get("Cookie"),
            "origin": self.headers.get("Origin"),
            "csrf": self.headers.get("X-CSRF-Token"),
        }).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Set-Cookie", "probe=value; HttpOnly; Secure; SameSite=Lax; Path=/")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        self.do_GET()

    def log_message(self, *args):
        pass


def request(port, path, method="GET", headers=None):
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
    try:
        conn.request(method, path, headers=headers or {})
        response = conn.getresponse()
        return response.status, dict(response.getheaders()), response.read()
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image")
    args = parser.parse_args()
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    upstream = ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
    threading.Thread(target=upstream.serve_forever, daemon=True).start()
    env = {**os.environ, "PORT": str(port),
           "API_UPSTREAM": f"http://127.0.0.1:{upstream.server_port}"}
    name = f"studio-production-smoke-{os.getpid()}"
    try:
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "Caddyfile"
            config.write_text((ROOT / "web/Caddyfile").read_text().replace(
                "root * /srv", f"root * {ROOT / 'web/build'}"))
            if args.image:
                command = ["docker", "run", "--rm", "--name", name, "--network", "host",
                           "-e", "PORT", "-e", "API_UPSTREAM", args.image]
            else:
                command = [os.environ.get("CADDY_BINARY", "caddy"), "run",
                           "--config", str(config), "--adapter", "caddyfile"]
            with tempfile.TemporaryFile(mode="w+") as log:
                process = subprocess.Popen(command, env=env, stdout=log, stderr=log)
                try:
                    for _ in range(100):
                        try:
                            if request(port, "/healthz")[0] == 200:
                                break
                        except OSError:
                            pass
                        if process.poll() is not None:
                            raise RuntimeError("Production server exited during startup")
                        time.sleep(0.1)
                    else:
                        raise RuntimeError("Production server did not become healthy")
                    for path in ["/", "/studio", "/studio/enquiries/example"]:
                        status, headers, body = request(port, path)
                        assert status == 200 and b'<div id="root">' in body, path
                        assert headers.get("Cache-Control") == "no-cache"
                    assert request(port, "/assets/missing.js")[0] == 404
                    assert request(port, "/brand/lens-dark.png")[0] == 200
                    status, headers, body = request(port, "/api/auth/session?probe=1", "POST", {
                        "Cookie": "probe=value", "Origin": "https://studio.example.com",
                        "X-CSRF-Token": "test-csrf",
                    })
                    assert status == 200
                    assert json.loads(body) == {
                        "path": "/api/auth/session?probe=1", "cookie": "probe=value",
                        "origin": "https://studio.example.com", "csrf": "test-csrf",
                    }
                    assert "HttpOnly; Secure; SameSite=Lax" in headers["Set-Cookie"]
                    assert headers["Cache-Control"] == "no-store"
                    assert request(port, "/api/unavailable")[0] == 503
                    print("Production routing smoke test passed")
                except Exception:
                    log.seek(0)
                    print(log.read())
                    raise
                finally:
                    if args.image:
                        subprocess.run(["docker", "stop", name], capture_output=True, check=False)
                    else:
                        process.terminate()
                    process.wait(timeout=15)
    finally:
        upstream.shutdown()
        upstream.server_close()


if __name__ == "__main__":
    main()
