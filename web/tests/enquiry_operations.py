"""Real staff search, paginated JSON download and partial/uncertain bulk writes."""

import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright
from pymongo import MongoClient

BASE = os.getenv("ENTRY_TEST_URL", "http://127.0.0.1:5173")
PASSWORD = "browser-test-password"

with (
    MongoClient(os.environ["BROWSER_MONGODB_URI"]) as mongo,
    sync_playwright() as playwright,
):
    db = mongo["studio_suite_browser_test"]
    for name in (
        "booking_requests",
        "staff_login_limits",
        "client_identities",
        "client_sessions",
        "client_access",
        "client_login_limits",
    ):
        db[name].delete_many({})
    identity = db.staff_identities.find_one({"_id": "browser-staff"})
    assert identity and identity["enabled"]
    values = [
        {
            "_id": str(uuid4()),
            "reference": f"IS-OPS-{index:03d}",
            "name": "=HYPERLINK(unsafe)" if index == 26 else "Operations Client",
            "email": "private-operations@example.test",
            "phone": "private operations phone",
            "event_type": "orchidbatch",
            "preferred_date": "2099-12-20",
            "collection": "essentials",
            "venue": "private venue",
            "message": "customer-private-operations-message",
            "studio_note": "internalonlyneedle",
            "consent": True,
            "state": "awaiting_studio_confirmation",
            "payload_hash": "private-auth-secret",
            "created_at": datetime.now(UTC) + timedelta(seconds=index),
        }
        for index in range(1, 27)
    ]
    db.booking_requests.insert_many(values)
    browser = playwright.chromium.launch(
        executable_path="/usr/bin/chromium"
        if Path("/usr/bin/chromium").exists()
        else None,
        headless=True,
    )
    context = browser.new_context(
        accept_downloads=True, viewport={"width": 1440, "height": 900}
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "/studio/operations")
    expect(page).to_have_url(BASE + "/studio")
    page.get_by_label("Staff email").fill("staff@example.test")
    page.get_by_label("Password", exact=True).fill(PASSWORD)
    page.get_by_role("button", name="Sign in", exact=True).click()
    expect(page).to_have_url(BASE + "/studio/home")
    with page.expect_response("**/api/studio/operations/enquiries?*") as initial_response:
        page.get_by_role("link", name="Enquiry operations", exact=True).click()
    assert initial_response.value.status == 200, initial_response.value.text()
    assert len(initial_response.value.json()["items"]) == 25, initial_response.value.text()
    expect(page.get_by_text("25 enquiries on this page.", exact=False)).to_be_visible()
    page.get_by_label("Search words").fill("orchidbatch")
    with page.expect_response(
        "**/api/studio/operations/enquiries?*"
    ) as search_response:
        page.get_by_role("button", name="Search enquiries", exact=True).click()
    assert search_response.value.status == 200
    assert search_response.value.headers["cache-control"] == "no-store"
    expect(page.get_by_label("Select IS-OPS-026", exact=True)).to_be_visible()
    page.get_by_role("button", name="Next results", exact=True).click()
    expect(page.get_by_text("1 enquiries on this page.", exact=False)).to_be_visible()
    expect(page.get_by_label("Select IS-OPS-001", exact=True)).to_be_visible()
    page.get_by_role("button", name="Previous results", exact=True).click()
    expect(page.get_by_label("Select IS-OPS-026", exact=True)).to_be_visible()

    with page.expect_download() as download:
        page.get_by_role(
            "button", name="Download this page as JSON", exact=True
        ).click()
    downloaded = download.value
    assert downloaded.suggested_filename == "studio-enquiries-page-0.json"
    exported = json.loads(Path(downloaded.path()).read_text())
    assert len(exported["items"]) == 25 and exported["next_offset"] == 25
    expected_fields = {
        "id",
        "reference",
        "name",
        "event_type",
        "preferred_date",
        "collection",
        "created_at",
        "studio_status",
        "studio_revision",
    }
    assert all(set(item) == expected_fields for item in exported["items"])
    assert "private-operations" not in json.dumps(exported)
    assert "internalonlyneedle" not in json.dumps(exported)
    assert exported["items"][0]["name"] == "=HYPERLINK(unsafe)"

    page.get_by_label("Select IS-OPS-026", exact=True).check()
    page.get_by_label("Select IS-OPS-025", exact=True).check()
    db.booking_requests.update_one(
        {"_id": values[-2]["_id"]}, {"$set": {"studio_revision": 5}}
    )
    page.get_by_label("Selected enquiries triage status").select_option("archived")
    page.get_by_role("button", name="Apply triage to 2 selected", exact=True).click()
    results = page.get_by_role("list", name="Bulk triage results")
    expect(results).to_contain_text("IS-OPS-026: updated")
    expect(results).to_contain_text("IS-OPS-025: conflict")
    saved = db.booking_requests.find_one({"_id": values[-1]["_id"]})
    assert saved["studio_status"] == "archived" and saved["studio_revision"] == 1
    assert (
        saved["studio_note"] == "internalonlyneedle"
        and saved["studio_updated_by"] == identity["_id"]
    )
    assert (
        db.booking_requests.find_one({"_id": values[-2]["_id"]})["studio_revision"] == 5
    )
    page.reload()
    expect(page.get_by_label("Select IS-OPS-026", exact=True)).to_be_visible()
    row = page.locator(".inbox-list > li").filter(
        has=page.get_by_label("Select IS-OPS-026", exact=True)
    )
    expect(row).to_contain_text("archived · revision 1")

    # The write succeeds on the actual API but the reply is lost. No automated
    # repeat is allowed; reload shows the one persisted mutation.
    def lose_reply(route):
        actual = route.fetch()
        assert actual.status == 200
        route.abort("failed")

    page.route("**/api/studio/operations/bulk-triage", lose_reply)
    page.get_by_label("Select IS-OPS-024", exact=True).check()
    page.get_by_role("button", name="Apply triage to 1 selected", exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text(
        "Some records may have changed. Refresh the list before retrying."
    )
    assert (
        db.booking_requests.find_one({"_id": values[-3]["_id"]})["studio_revision"] == 1
    )
    page.unroute("**/api/studio/operations/bulk-triage", lose_reply)
    page.get_by_role("button", name="Refresh list", exact=True).click()
    row = page.locator(".inbox-list > li").filter(
        has=page.get_by_label("Select IS-OPS-024", exact=True)
    )
    expect(row).to_contain_text("in_review · revision 1")
    assert not page.get_by_role(
        "button", name="Apply triage to 0 selected", exact=True
    ).is_enabled()
    for width in (320, 390, 768, 1440):
        page.set_viewport_size({"width": width, "height": 900})
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), (
            width
        )
    assert "internalonlyneedle" not in page.locator("body").inner_text()

    page.get_by_label("Search words").fill("internalonlyneedle")
    with page.expect_response("**/api/studio/operations/enquiries?*") as private_search:
        page.get_by_role("button", name="Search enquiries", exact=True).click()
    assert private_search.value.status == 200, private_search.value.text()
    assert private_search.value.json()["items"] == []
    expect(page.get_by_text("0 enquiries on this page.", exact=False)).to_be_visible()
    assert not page.get_by_role(
        "button", name="Download this page as JSON", exact=True
    ).is_enabled()
    db.client_identities.insert_one(
        {
            **identity,
            "_id": "ops-client",
            "role": "client",
            "email": "ops-client@example.test",
        }
    )
    client_context = browser.new_context()
    client_page = client_context.new_page()
    client_page.goto(BASE + "/client")
    client_page.get_by_label("Client email").fill("ops-client@example.test")
    client_page.get_by_label("Password", exact=True).fill(PASSWORD)
    client_page.get_by_role("button", name="Sign in", exact=True).click()
    expect(client_page).to_have_url(BASE + "/client/home")
    for endpoint in ("enquiries", "export"):
        assert (
            client_context.request.get(
                BASE + "/api/studio/operations/" + endpoint
            ).status
            == 401
        )
    client_page.goto(BASE + "/studio/operations")
    expect(client_page).to_have_url(BASE + "/studio")
    client_context.close()
    page.get_by_role("button", name="Sign out", exact=True).click()
    expect(page).to_have_url(BASE + "/studio")
    assert context.request.get(BASE + "/api/studio/operations/export").status == 401
    assert not errors, errors
    assert db.booking_requests.count_documents({}) == 26
    browser.close()

print(
    "Enquiry operations browser: indexed search, page download, partial and uncertain saves, persistence and role isolation passed"
)
