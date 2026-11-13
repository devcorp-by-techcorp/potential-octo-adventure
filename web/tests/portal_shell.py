"""Production-built portal layout acceptance with explicit UI-only API fixtures.

This verifies the shared frame, not server authorization or feature completion.
The real MongoDB journeys in run_browser.py retain those responsibilities.
"""

import json
import os
import socket
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = Path(os.getenv("PORTAL_TEST_ARTIFACTS", ROOT / "work/portal-shell"))
STUDIO_ROUTES = [
    "/studio/home", "/studio/enquiries", "/studio/bookings", "/studio/contacts",
    "/studio/content", "/studio/operations", "/studio/booking-resources",
    "/studio/booking-drafts", "/studio/reporting", "/studio/enquiries/layout-fixture",
    "/studio/bookings/layout-fixture",
]
CLIENT_ROUTES = ["/client/home", "/client/enquiries/layout-fixture"]
CHECKPOINTS = [
    (375, 812), (812, 375), (390, 844), (844, 390), (428, 926), (926, 428),
    (744, 1133), (1133, 744), (834, 1194), (1194, 834), (1152, 1440), (1152, 900),
    (1280, 700), (1440, 900), (1920, 1080), (2560, 1080),
]
SAMPLES = [(width, 700 if width > 700 else 900) for width in range(375, 2561, 80)]
EDGES = [(width, height) for width in (767, 768, 1151, 1152, 1153)
         for height in (375, 900)]
SESSION = {"identity": {"id": "layout-fixture", "name": "Layout fixture",
                        "email": "layout@example.test"}, "csrf_token": "ui-only-fixture"}
FAILURE = "Layout fixture: service unavailable."


def geometry(page):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), page.url
    assert page.locator(".portal-content").evaluate("el => el.clientWidth >= 250"), page.url
    assert page.locator("body").evaluate("""el => {
      const s = getComputedStyle(el);
      return s.backgroundColor === 'rgb(250, 251, 252)' && s.colorScheme === 'light';
    }""")
    assert page.locator('[data-theme="dark"]').count() == 0
    failures = page.locator(".portal-shell a, .portal-shell button, .portal-shell input, .portal-shell select, .portal-shell textarea").evaluate_all("""els => els.filter(el => {
      const r = el.getBoundingClientRect();
      return el.getClientRects().length && (r.width < 43.9 || r.height < 43.9);
    }).map(el => ({text: el.textContent, rect: el.getBoundingClientRect().toJSON()}))""")
    assert not failures, failures
    compact = page.viewport_size["width"] < 1152
    expect(page.locator(".portal-rail")).to_be_hidden() if compact else expect(page.locator(".portal-rail")).to_be_visible()
    expect(page.locator(".portal-compact-nav")).to_be_visible() if compact else expect(page.locator(".portal-compact-nav")).to_be_hidden()
    if not compact:
        assert page.locator(".portal-rail").bounding_box()["width"] == 280
        assert page.locator(".portal-topbar").bounding_box()["height"] == 72
    else:
        assert page.locator(".portal-compact-nav a").count() <= 4
        assert page.locator(".portal-compact-nav").evaluate("el => el.scrollWidth <= el.clientWidth")
        # The final content can scroll above the fixed bottom navigation.
        page.evaluate("scrollTo(0, document.documentElement.scrollHeight)")
        assert page.locator(".portal-content").bounding_box()["y"] + page.locator(".portal-content").bounding_box()["height"] <= page.locator(".portal-compact-nav").bounding_box()["y"] + 1


def run(base):
    rows = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium" if Path("/usr/bin/chromium").exists() else None)
        context = browser.new_context(reduced_motion="reduce")
        context.add_init_script("localStorage.setItem('illuminate-theme', 'dark')")
        state = {"denied": False, "empty": False}

        def api(route):
            path = urlparse(route.request.url).path
            if path in ("/api/auth/session", "/api/auth/client/session", "/api/studio/home"):
                route.fulfill(status=403 if state["denied"] else 200,
                              json={"detail": "Denied layout fixture"} if state["denied"] else SESSION)
            elif state["empty"] and path in ("/api/auth/sessions", "/api/auth/client/sessions"):
                route.fulfill(json={"other_active_sessions": 0})
            elif state["empty"] and path == "/api/studio/dashboard":
                route.fulfill(json={"active_enquiries": 0, "bookings": {"planning": 0}})
            elif state["empty"] and path in ("/api/studio/enquiries", "/api/client/enquiries", "/api/studio/contacts"):
                route.fulfill(json={"items": [], "next_cursor": None})
            elif state["empty"] and path == "/api/client/bookings":
                route.fulfill(json=[])
            else:
                route.fulfill(status=503, json={"detail": FAILURE})

        context.route("**/api/**", api)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            for width, height in dict.fromkeys(CHECKPOINTS + SAMPLES + EDGES):
                page.set_viewport_size({"width": width, "height": height})
                for path in STUDIO_ROUTES + CLIENT_ROUTES:
                    page.goto(base + path)
                    expect(page.locator(".portal-shell")).to_be_visible()
                    expect(page.get_by_role("alert").first).to_have_text(FAILURE)
                    geometry(page)
                    rows.append({"route": path, "width": width, "height": height, "state": "service-error", "result": "pass"})
                print(f"PASS portal error-state matrix: {width}x{height}, {len(STUDIO_ROUTES + CLIENT_ROUTES)} routes", flush=True)

            # Empty real-component states, with successful UI fixtures explicitly bounded.
            state["empty"] = True
            for width, height in CHECKPOINTS:
                page.set_viewport_size({"width": width, "height": height})
                for path in ("/studio/home", "/studio/contacts", "/studio/enquiries", "/client/home"):
                    page.goto(base + path, wait_until="networkidle")
                    expect(page.locator(".portal-shell")).to_be_visible()
                    expect(page.get_by_role("alert")).to_have_count(0)
                    geometry(page)
                    rows.append({"route": path, "width": width, "height": height, "state": "empty", "result": "pass"})
                if width in (375, 744, 1152, 1440):
                    page.screenshot(path=str(ARTIFACTS / f"client-{width}x{height}.png"), full_page=True)

            for width, height in [(375, 812), (812, 375), (744, 1133), (1151, 900)]:
                page.set_viewport_size({"width": width, "height": height})
                page.goto(base + "/studio/home", wait_until="networkidle")
                opener = page.get_by_role("button", name="More studio navigation")
                opener.focus()
                before = page.evaluate("({x: scrollX, y: scrollY})")
                page.keyboard.press("Enter")
                dialog = page.get_by_role("dialog")
                expect(dialog).to_be_visible()
                assert dialog.evaluate("el => el.scrollWidth <= el.clientWidth")
                for _ in range(15):
                    page.keyboard.press("Tab")
                    assert dialog.evaluate("el => el.contains(document.activeElement)")
                page.keyboard.press("Shift+Tab")
                assert dialog.evaluate("el => el.contains(document.activeElement)")
                close = dialog.get_by_role("button", name="Close dialog")
                close.focus()
                assert close.evaluate("el => getComputedStyle(el).outlineWidth") == "1px"
                page.keyboard.press("Escape")
                expect(dialog).to_have_count(0)
                expect(opener).to_be_focused()
                assert page.evaluate("({x: scrollX, y: scrollY})") == before
                opener.click()
                dialog.get_by_role("link", name="Reporting", exact=True).click()
                expect(page).to_have_url(base + "/studio/reporting")
                expect(page.get_by_role("dialog")).to_have_count(0)
                expect(page.get_by_role("button", name="More studio navigation")).to_have_class("is-current")
                geometry(page)
                page.screenshot(path=str(ARTIFACTS / f"studio-{width}x{height}.png"), full_page=True)
                page.get_by_role("button", name="More studio navigation").click()
                expect(page.get_by_role("dialog")).to_be_visible()
                page.set_viewport_size({"width": 1152, "height": 900})
                expect(page.get_by_role("dialog")).to_have_count(0)
                assert page.locator("body").evaluate("el => el.style.overflow") != "hidden"
                expect(page.get_by_role("link", name="Reporting", exact=True)).to_have_attribute("aria-current", "page")
                geometry(page)
            # Denied restoration never leaves protected shell or identity visible.
            state["denied"] = True
            for path in ("/studio/home", "/client/home"):
                page.goto(base + path)
                expect(page.locator(".portal-shell")).to_have_count(0)
                expect(page.get_by_label("Password", exact=True)).to_be_visible()
                assert not page.get_by_text("Signed in as layout@example.test").count()
            assert not errors, errors
            (ARTIFACTS / "result.json").write_text(json.dumps({
                "status": "passed", "bundle": "web/build", "rows": rows,
                "lifecycle": "keyboard/focus/scroll/route/resize/denied-restoration pass",
                "api": "synthetic UI layout fixtures; server authentication not verified",
                "platforms": ["Chromium web"], "native": "not verified",
            }, indent=2) + "\n")
            print(f"PASS portal shell: {len(rows)} route/state/geometry rows plus lifecycle checks", flush=True)
        except Exception:
            page.screenshot(path=str(ARTIFACTS / "failure.png"), full_page=True)
            (ARTIFACTS / "failure.json").write_text(json.dumps({"url": page.url, "viewport": page.viewport_size, "errors": errors}, indent=2))
            raise
        finally:
            context.close()
            browser.close()


def main():
    if not (ROOT / "web/build/index.html").is_file():
        raise RuntimeError("Build the production workspace before portal verification")
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    (ARTIFACTS / "result.json").unlink(missing_ok=True)
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    with (ARTIFACTS / "preview.log").open("w") as log:
        process = subprocess.Popen(
            ["node", str(next(p for p in (ROOT / "web/node_modules/vite/bin/vite.js", ROOT / "node_modules/vite/bin/vite.js") if p.is_file())), "preview", "--host", "127.0.0.1",
             "--port", str(port), "--strictPort"], cwd=ROOT / "web", stdout=log, stderr=log,
        )
        try:
            base = f"http://127.0.0.1:{port}"
            for _ in range(100):
                if process.poll() is not None:
                    raise RuntimeError("Production preview exited during startup")
                try:
                    with urlopen(base, timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    pass
                time.sleep(0.1)
            else:
                raise RuntimeError("Production preview did not become ready")
            run(base)
        finally:
            process.terminate()
            process.wait(timeout=10)


if __name__ == "__main__":
    main()
