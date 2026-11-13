"""Real staff/client browsers: own-session withdrawal and lost-response recovery."""

import os
import sys
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from auth import password_hash

BASE = os.getenv("ENTRY_TEST_URL", "http://127.0.0.1:5173")
PASSWORD = "browser-test-password"

with MongoClient(os.environ["BROWSER_MONGODB_URI"]) as mongo, sync_playwright() as p:
    db = mongo["studio_suite_browser_test"]
    browser = p.chromium.launch(headless=True)
    errors = []
    for scope in ("staff", "client"):
        db[f"{scope}_login_limits"].delete_many({})
        email = (
            "staff@example.test" if scope == "staff" else "session-client@example.test"
        )
        if scope == "client":
            db.client_identities.insert_one(
                {
                    "_id": str(uuid4()),
                    "email": email,
                    "name": "Session Client",
                    "role": "client",
                    "enabled": True,
                    "auth_version": str(uuid4()),
                    "password_hash": password_hash(PASSWORD),
                }
            )
        prefix = "/api/auth/client" if scope == "client" else "/api/auth"
        portal = "/client" if scope == "client" else "/studio"
        contexts = [browser.new_context() for _ in range(3)]
        pages = [context.new_page() for context in contexts]
        for page in pages:
            page.on("pageerror", lambda error: errors.append(str(error)))

        def sign_in(page, portal=portal, scope=scope, email=email, prefix=prefix):
            page.goto(BASE + portal)
            page.get_by_label(
                "Client email" if scope == "client" else "Staff email"
            ).fill(email)
            page.get_by_label("Password", exact=True).fill(PASSWORD)
            with page.expect_response("**" + prefix + "/login") as signed_in:
                page.get_by_role("button", name="Sign in", exact=True).click()
            assert signed_in.value.status == 200, signed_in.value.text()
            expect(page).to_have_url(BASE + portal + "/home", timeout=15_000)
            expect(page.get_by_role("region", name="Account sessions")).to_be_visible()

        first, second, later = pages
        sign_in(first)
        sign_in(second)
        panel = first.get_by_role("region", name="Account sessions")
        panel.get_by_role("button", name="Refresh sessions", exact=True).click()
        expect(
            panel.get_by_text("1 other active sessions.", exact=True)
        ).to_be_visible()

        def lose_response(route):
            # Execute the real endpoint and lose only its response boundary.
            saved = route.fetch()
            assert saved.status == 200 and saved.json() == {"revoked_count": 1}
            route.abort("failed")

        first.route("**" + prefix + "/sessions/revoke-others", lose_response)
        panel.get_by_role("button", name="Sign out other sessions", exact=True).click()
        expect(panel.get_by_role("alert")).to_contain_text(
            "could not be confirmed", timeout=20_000
        )
        assert contexts[1].request.get(BASE + prefix + "/session").status == 401
        second.reload()
        expect(second).to_have_url(BASE + portal, timeout=15_000)
        sign_in(later)
        first.unroute("**" + prefix + "/sessions/revoke-others")
        with first.expect_response(
            "**" + prefix + "/sessions/revoke-others"
        ) as recovered:
            panel.get_by_role(
                "button", name="Retry session sign-out", exact=True
            ).click()
        assert recovered.value.status == 200, recovered.value.text()
        assert recovered.value.json() == {"revoked_count": 1}
        expect(
            panel.get_by_role("status").filter(has_text="other sessions signed out")
        ).to_contain_text("1 other sessions signed out")
        expect(
            panel.get_by_text("1 other active sessions.", exact=True)
        ).to_be_visible()
        assert contexts[2].request.get(BASE + prefix + "/session").status == 200
        assert contexts[0].request.get(BASE + prefix + "/session").status == 200
        first.reload()
        panel = first.get_by_role("region", name="Account sessions")
        expect(
            panel.get_by_text("1 other active sessions.", exact=True)
        ).to_be_visible()
        with first.expect_response(
            "**" + prefix + "/sessions/revoke-others"
        ) as withdrawn:
            panel.get_by_role(
                "button", name="Sign out other sessions", exact=True
            ).click()
        assert withdrawn.value.status == 200, withdrawn.value.text()
        expect(
            panel.get_by_role("status").filter(has_text="other sessions signed out")
        ).to_contain_text("1 other sessions signed out")
        expect(
            panel.get_by_text("0 other active sessions.", exact=True)
        ).to_be_visible()
        expect(
            panel.get_by_role("button", name="Sign out other sessions", exact=True)
        ).to_be_disabled()
        assert contexts[2].request.get(BASE + prefix + "/session").status == 401
        for width in (320, 390, 768, 1440):
            first.set_viewport_size({"width": width, "height": 900})
            assert not first.evaluate(
                "document.documentElement.scrollWidth > innerWidth"
            ), width
        storage = first.evaluate(
            "JSON.stringify({...localStorage}) + JSON.stringify({...sessionStorage})"
        )
        assert PASSWORD not in storage and "csrf_token" not in storage
        assert db.client_access.count_documents({}) == 0
        for context in contexts:
            context.close()
    assert not errors, errors
    browser.close()
    print(
        "account sessions: staff/client real sign-ins, withdrawal, persistence, lost-response retry preserving later login, isolation and four widths passed"
    )
