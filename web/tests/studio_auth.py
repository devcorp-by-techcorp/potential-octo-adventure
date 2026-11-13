"""Real API/MongoDB studio regression. Only failures are intercepted in the browser."""

import os
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from pymongo import MongoClient

BASE = os.getenv("ENTRY_TEST_URL", "http://127.0.0.1:5173")
PASSWORD = "browser-test-password"
with MongoClient(os.environ["BROWSER_MONGODB_URI"]) as mongo, sync_playwright() as p:
    database = mongo["studio_suite_browser_test"]
    browser = p.chromium.launch(
        executable_path="/usr/bin/chromium" if Path("/usr/bin/chromium").exists() else None,
        headless=True,
    )
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    def sign_in():
        page.get_by_label("Staff email").fill("staff@example.test")
        page.get_by_label("Password", exact=True).fill(PASSWORD)
        with page.expect_response(
            lambda response: response.url.endswith("/api/auth/login")
        ) as login_response:
            page.get_by_role("button", name="Sign in", exact=True).click()
        assert login_response.value.status == 200, login_response.value.text()
        expect(page).to_have_url(BASE + "/studio/home", timeout=15_000)
        expect(page.get_by_text("Welcome, Browser Staff.")).to_be_visible()

    page.goto(BASE + "/studio/home")
    expect(page).to_have_url(BASE + "/studio")
    expect(page.get_by_role("status")).to_contain_text("session has expired")
    assert context.request.get(BASE + "/api/studio/home").status == 401
    page.evaluate('localStorage.setItem("illuminate-theme", "dark")')
    page.reload()
    expect(page.get_by_label("Staff email")).to_be_visible()
    expect(page.locator("body")).to_have_attribute("data-theme", "light")
    page.screenshot(path=str(Path(tempfile.gettempdir()) / "studio-sign-in.png"))

    # Entire sign-in is keyboard accessible, including submission and error recovery.
    page.keyboard.press("Tab")
    expect(page.get_by_label("Staff email")).to_be_focused()
    page.keyboard.type("staff@example.test")
    page.keyboard.press("Tab")
    expect(page.get_by_label("Password", exact=True)).to_be_focused()
    page.keyboard.type("wrong-password")
    page.keyboard.press("Tab")
    expect(page.get_by_role("button", name="Sign in", exact=True)).to_be_focused()
    with page.expect_response(lambda response: response.url.endswith("/api/auth/login")) as failed_login:
        page.keyboard.press("Enter")
    assert failed_login.value.status == 401
    expect(page.get_by_role("alert")).to_contain_text("Email or password is incorrect")
    expect(page.get_by_label("Staff email")).to_be_focused()
    assert page.get_by_label("Password", exact=True).input_value() == ""
    sign_in()
    expect(page.get_by_text("Signed in as staff@example.test")).to_be_visible()
    assert context.request.get(BASE + "/api/studio/home").status == 200
    assert context.request.post(BASE + "/api/auth/logout").status == 403
    cookies = context.cookies()
    cookie = next(item for item in cookies if item["name"] == "studio_session")
    assert cookie["httpOnly"] and cookie["sameSite"] == "Lax"
    assert "studio_session" not in page.evaluate("document.cookie")
    stored = page.evaluate(
        "JSON.stringify({...localStorage}) + JSON.stringify({...sessionStorage})"
    )
    assert PASSWORD not in stored and cookie["value"] not in stored and "csrf_token" not in stored
    from hashlib import sha256

    stored_session = database.staff_sessions.find_one(
        {"_id": sha256(cookie["value"].encode()).hexdigest()}
    )
    assert stored_session and cookie["value"] not in str(stored_session)
    page.reload()
    expect(page.get_by_text("Welcome, Browser Staff.")).to_be_visible()
    page.goto(BASE + "/studio")
    expect(page).to_have_url(BASE + "/studio/home")

    # Server-owned role changes deny API access and clear protected UI on reload.
    database.staff_identities.update_one({"_id": "browser-staff"}, {"$set": {"role": "client"}})
    assert context.request.get(BASE + "/api/studio/home", headers={"X-Role": "staff"}).status == 403
    page.reload()
    expect(page).to_have_url(BASE + "/studio")
    expect(page.get_by_label("Staff email")).to_be_visible()
    database.staff_identities.update_one({"_id": "browser-staff"}, {"$set": {"role": "staff"}})
    context.clear_cookies()
    sign_in()

    # A failed logout is recoverable and never claims that a session was revoked.
    page.route(
        "**/api/auth/logout",
        lambda route: route.fulfill(
            status=503,
            json={"detail": "Studio access is temporarily unavailable. Please try again."},
        ),
    )
    page.get_by_role("button", name="Sign out", exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    expect(page.get_by_text("Welcome, Browser Staff.")).to_be_visible()
    page.unroute("**/api/auth/logout")
    page.get_by_role("button", name="Sign out", exact=True).click()
    expect(page).to_have_url(BASE + "/studio")
    expect(page.get_by_role("status")).to_contain_text("signed out")
    assert context.request.get(BASE + "/api/studio/home").status == 401
    assert not any(item["name"] == "studio_session" for item in context.cookies())
    page.reload()
    expect(page.get_by_label("Staff email")).to_be_visible()

    # Mobile form and home remain usable; no horizontal overflow at supported widths.
    for width in [320, 390, 768, 1024, 1440]:
        page.set_viewport_size({"width": width, "height": 844})
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), width
    page.set_viewport_size({"width": 320, "height": 844})
    sign_in()
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
    page.screenshot(path=str(Path(tempfile.gettempdir()) / "studio-home-mobile.png"))

    # App expiry (even before TTL deletion) removes protected content on reload.
    database.staff_sessions.update_many(
        {}, {"$set": {"expires_at": datetime.now(UTC) - timedelta(seconds=1)}}
    )
    page.reload()
    expect(page).to_have_url(BASE + "/studio")
    expect(page.get_by_role("status")).to_contain_text("session has expired")
    assert not page.get_by_text("Welcome, Browser Staff.").count()
    sign_in()
    database.staff_identities.update_one({"_id": "browser-staff"}, {"$set": {"enabled": False}})
    page.reload()
    expect(page).to_have_url(BASE + "/studio")
    assert context.request.get(BASE + "/api/studio/home").status == 401
    database.staff_identities.update_one({"_id": "browser-staff"}, {"$set": {"enabled": True}})
    context.clear_cookies()
    database.staff_login_limits.delete_many({})

    # Session loading failure shows retry; protected content stays absent until real recovery.
    page.route(
        "**/api/auth/session",
        lambda route: route.fulfill(
            status=503,
            json={"detail": "Studio access is temporarily unavailable. Please try again."},
        ),
    )
    page.goto(BASE + "/studio/home")
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    assert not page.get_by_text("Welcome, Browser Staff.").count()
    page.unroute("**/api/auth/session")
    page.get_by_role("button", name="Try again", exact=True).click()
    expect(page).to_have_url(BASE + "/studio")

    page.route(
        "**/api/auth/login",
        lambda route: route.fulfill(
            status=503,
            json={"detail": "Studio access is temporarily unavailable. Please try again."},
        ),
    )
    page.get_by_label("Staff email").fill("staff@example.test")
    page.get_by_label("Password", exact=True).fill(PASSWORD)
    page.get_by_role("button", name="Sign in", exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    assert page.get_by_label("Staff email").input_value() == "staff@example.test"
    assert page.get_by_label("Password", exact=True).input_value() == ""
    page.unroute("**/api/auth/login")
    sign_in()
    assert not errors, errors
    print(
        "studio auth: API/MongoDB sign-in, reload, roles, CSRF, logout, expiry, disable, "
        "keyboard, mobile, themes, and recovery passed"
    )
    browser.close()
