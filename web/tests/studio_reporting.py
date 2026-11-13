"""Staff aggregate reporting through real browser/API/MongoDB fixture records."""

import os
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright
from pymongo import MongoClient

BASE = os.getenv("ENTRY_TEST_URL", "http://127.0.0.1:5173")
PASSWORD = "browser-test-password"
LABELS = {
    "enquiries": "All enquiries",
    "new_enquiries": "New enquiries",
    "in_review_enquiries": "In review",
    "archived_enquiries": "Archived enquiries",
    "unclassified_enquiries": "Unclassified enquiries",
    "enabled_clients": "Enabled clients",
    "active_access_grants": "Active enquiry access",
}

with (
    MongoClient(os.environ["BROWSER_MONGODB_URI"]) as mongo,
    sync_playwright() as playwright,
):
    db = mongo["studio_suite_browser_test"]
    for name in (
        "booking_requests",
        "client_identities",
        "client_access",
        "client_sessions",
        "client_login_limits",
        "staff_login_limits",
    ):
        db[name].delete_many({})
    identity = db.staff_identities.find_one({"_id": "browser-staff"})
    assert identity and identity["enabled"] and identity["role"] == "staff"
    browser = playwright.chromium.launch(
        executable_path="/usr/bin/chromium"
        if Path("/usr/bin/chromium").exists()
        else None,
        headless=True,
    )
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    def counts(expected):
        expect(page.get_by_role("status")).to_contain_text("Observed")
        for key, count in expected.items():
            row = page.locator(".enquiry-details > div").filter(
                has=page.get_by_text(LABELS[key], exact=True)
            )
            expect(row.locator("strong")).to_have_text(str(count))

    page.goto(BASE + "/studio/reporting")
    expect(page).to_have_url(BASE + "/studio")
    assert context.request.get(BASE + "/api/studio/reporting").status == 401
    page.get_by_label("Staff email").fill("staff@example.test")
    page.get_by_label("Password", exact=True).fill(PASSWORD)
    with page.expect_response("**/api/auth/login") as staff_login:
        page.get_by_role("button", name="Sign in", exact=True).click()
    assert staff_login.value.status == 200, staff_login.value.text()
    expect(page).to_have_url(BASE + "/studio/home", timeout=15_000)
    with page.expect_response("**/api/studio/reporting") as first_response:
        page.get_by_role("link", name="Reporting", exact=True).click()
    assert first_response.value.status == 200
    assert first_response.value.headers["cache-control"] == "no-store"
    counts({key: 0 for key in LABELS})

    enquiry_id = str(uuid4())
    second_id = str(uuid4())
    saved_enquiry = {
        "reference": "IS-REPORT-TEST",
        "name": "Report Test Client",
        "email": "private-report@example.test",
        "event_type": "Portrait",
        "preferred_date": "2099-12-20",
        "collection": "essentials",
        "consent": True,
        "state": "awaiting_studio_confirmation",
        "created_at": datetime.now(UTC),
    }
    db.booking_requests.insert_many(
        [
            {
                **saved_enquiry,
                "_id": enquiry_id,
                "studio_status": "in_review",
                "studio_note": "never-expose-private-report-note",
            },
            {
                **saved_enquiry,
                "_id": second_id,
                "reference": "IS-REPORT-TEST-2",
                "studio_status": None,
            },
            {
                **saved_enquiry,
                "_id": str(uuid4()),
                "reference": "IS-REPORT-TEST-3",
                "studio_status": "archived",
            },
            {
                **saved_enquiry,
                "_id": str(uuid4()),
                "reference": "IS-REPORT-TEST-4",
                "studio_status": "unsupported",
            },
        ]
    )
    db.client_identities.insert_many(
        [
            {
                "_id": "report-client",
                "email": "report-client@example.test",
                "name": "Report Client",
                "role": "client",
                "enabled": True,
                "auth_version": "report-browser-v1",
                "password_hash": identity["password_hash"],
            },
            {"_id": "report-disabled", "role": "client", "enabled": False},
        ]
    )
    db.client_access.insert_many(
        [
            {
                "_id": "report-active",
                "client_id": "report-client",
                "enquiry_id": enquiry_id,
                "revoked_at": None,
            },
            {
                "_id": "report-revoked",
                "client_id": "report-client",
                "enquiry_id": second_id,
                "revoked_at": datetime.now(UTC),
            },
            {
                "_id": "report-disabled",
                "client_id": "report-disabled",
                "enquiry_id": enquiry_id,
                "revoked_at": None,
            },
            {
                "_id": "report-orphan",
                "client_id": "report-client",
                "enquiry_id": "absent",
                "revoked_at": None,
            },
        ]
    )
    with page.expect_response("**/api/studio/reporting") as updated_response:
        page.get_by_role("button", name="Refresh counts").click()
    assert updated_response.value.status == 200
    counts(
        {
            "enquiries": 4,
            "new_enquiries": 1,
            "in_review_enquiries": 1,
            "archived_enquiries": 1,
            "unclassified_enquiries": 1,
            "enabled_clients": 1,
            "active_access_grants": 1,
        }
    )
    assert "private-report" not in page.locator("body").inner_text()
    assert "never-expose" not in updated_response.value.text()
    page.reload()
    counts({"enquiries": 4, "active_access_grants": 1})
    for width in (320, 390, 768, 1440):
        page.set_viewport_size({"width": width, "height": 900})
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), (
            width
        )

    # Negative provider/network fixture only: no successful report is fabricated.
    def unavailable(route):
        route.fulfill(status=503, json={"detail": "Reporting temporarily unavailable."})

    page.route("**/api/studio/reporting", unavailable)
    page.get_by_role("button", name="Refresh counts").click()
    expect(page.get_by_role("alert")).to_have_text("Reporting temporarily unavailable.")
    assert not page.locator(".enquiry-details").count()
    page.unroute("**/api/studio/reporting", unavailable)
    page.get_by_role("button", name="Refresh counts").click()
    counts({"enquiries": 4})

    client_context = browser.new_context()
    client_page = client_context.new_page()
    client_page.on("pageerror", lambda error: errors.append(str(error)))
    client_page.goto(BASE + "/client")
    client_page.get_by_label("Client email").fill("report-client@example.test")
    client_page.get_by_label("Password", exact=True).fill(PASSWORD)
    with client_page.expect_response("**/api/auth/client/login") as client_login:
        client_page.get_by_role("button", name="Sign in", exact=True).click()
    assert client_login.value.status == 200, client_login.value.text()
    expect(client_page).to_have_url(BASE + "/client/home", timeout=15_000)
    expect(
        client_page.get_by_role("status").filter(has_text="enquiries on this page")
    ).to_contain_text("1 enquiries on this page.")
    assert "never-expose" not in client_page.locator("body").inner_text()
    assert client_context.request.get(BASE + "/api/auth/client/session").status == 200
    denied = client_context.request.get(BASE + "/api/studio/reporting")
    assert denied.status == 401 and denied.headers["cache-control"] == "no-store"
    client_page.goto(BASE + "/studio/reporting")
    expect(client_page).to_have_url(BASE + "/studio")
    assert not client_page.locator(".enquiry-details").count()
    client_context.close()

    # Real database invalidation must remove stale observations from the browser.
    db.staff_identities.update_one(
        {"_id": identity["_id"]}, {"$set": {"enabled": False}}
    )
    try:
        page.get_by_role("button", name="Refresh counts").click()
        expect(page).to_have_url(BASE + "/studio")
        expect(page.get_by_label("Staff email")).to_be_visible()
        assert not page.locator(".enquiry-details").count()
    finally:
        db.staff_identities.update_one(
            {"_id": identity["_id"]}, {"$set": {"enabled": True}}
        )
    assert not errors, errors
    browser.close()

print(
    "Studio reporting browser: persisted counts, refresh, reload, privacy, role isolation, failure recovery and invalidation passed"
)
