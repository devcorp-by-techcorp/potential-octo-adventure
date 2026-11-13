"""Real application booking proposal save, reload, revision, history and client privacy."""

import os
import sys
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from auth import password_hash
from tests.test_studio_enquiries import record

BASE = os.getenv("ENTRY_TEST_URL", "http://127.0.0.1:5173")
with MongoClient(os.environ["BROWSER_MONGODB_URI"]) as mongo, sync_playwright() as p:
    db = mongo.studio_suite_browser_test
    db.staff_login_limits.delete_many({})
    db.booking_drafts.delete_many({})
    db.booking_draft_commands.delete_many({})
    db.booking_draft_history.delete_many({})
    db.staff_identities.update_one(
        {"_id": "browser-staff"}, {"$set": {"enabled": True}}
    )
    enquiry = record(email="proposal-client@example.test")
    db.booking_requests.insert_one(enquiry)
    enquiry_snapshot = db.booking_requests.find_one({"_id": enquiry["_id"]})
    client_id = str(uuid4())
    client = {
        "_id": client_id,
        "email": enquiry["email"],
        "name": "Proposal Client",
        "role": "client",
        "enabled": True,
        "auth_version": str(uuid4()),
        "password_hash": password_hash("browser-test-password"),
    }
    db.client_identities.insert_one(client)
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    page.goto(BASE + "/studio")
    page.get_by_label("Staff email").fill("staff@example.test")
    page.get_by_label("Password", exact=True).fill("browser-test-password")
    page.get_by_role("button", name="Sign in", exact=True).click()
    expect(page).to_have_url(BASE + "/studio/home")
    page.goto(BASE + "/studio/enquiries/" + enquiry["_id"])
    form = page.get_by_role("heading", name="Prepare a booking proposal").locator("..")
    form.get_by_label("Start with timezone offset").fill("2099-12-20T10:00:00+11:00")
    form.get_by_label("End with timezone offset").fill("2099-12-20T12:00:00+11:00")
    form.get_by_label("IANA timezone").fill("Australia/Melbourne")
    with page.expect_response(
        lambda response: response.request.method == "POST"
        and response.url.endswith("/api/studio/enquiries/" + enquiry["_id"] + "/booking-draft")
    ) as created_response:
        form.get_by_role("button", name="Save proposal").click()
    assert created_response.value.status == 200, created_response.value.text()
    expect(
        page.get_by_text("Booking proposal saved. No availability reserved.", exact=True)
    ).to_be_visible()
    saved = db.booking_drafts.find_one({"enquiry_id": enquiry["_id"]})
    assert saved and saved["state"] == "draft" and saved["revision"] == 0
    assert db.booking_requests.find_one({"_id": enquiry["_id"]}) == enquiry_snapshot
    page.get_by_role("link", name="Booking proposals", exact=True).click()
    expect(page.get_by_role("status")).to_have_text("1 proposals on this page.")
    page.reload()
    expect(page.get_by_role("status")).to_have_text("1 proposals on this page.")
    page.get_by_role(
        "button", name="Edit proposal " + enquiry["reference"], exact=True
    ).click()
    page.get_by_label("Start with timezone offset").fill("2099-12-21T10:00:00+11:00")
    page.get_by_label("End with timezone offset").fill("2099-12-21T12:00:00+11:00")
    page.get_by_role("button", name="Save proposal").click()
    expect(
        page.get_by_role(
            "button", name="Edit proposal " + enquiry["reference"], exact=True
        )
    ).to_be_visible()
    page.get_by_role(
        "button", name="Change history " + enquiry["reference"], exact=True
    ).click()
    expect(
        page.get_by_role("heading", name="Proposal history").locator("..")
    ).to_contain_text("Revision 1")
    page.get_by_role(
        "button", name="Edit proposal " + enquiry["reference"], exact=True
    ).click()
    page.get_by_role("button", name="Cancel proposal").click()
    expect(
        page.get_by_role(
            "button", name="Edit proposal " + enquiry["reference"], exact=True
        )
    ).to_have_count(0)
    expect(
        page.get_by_role("heading", name="Proposal history").locator("..")
    ).to_contain_text("Revision 2")
    assert db.booking_drafts.find_one({"_id": saved["_id"]})["state"] == "cancelled"
    assert db.booking_draft_history.count_documents({"draft_id": saved["_id"]}) == 3
    # Real client login with an explicit grant; no inferred email access.
    db.client_access.update_one(
        {"client_id": client["_id"], "enquiry_id": enquiry["_id"]},
        {
            "$set": {"revoked_at": None, "created_at": enquiry["created_at"]},
            "$setOnInsert": {"_id": str(uuid4())},
        },
        upsert=True,
    )
    client_context = browser.new_context()
    client_page = client_context.new_page()
    client_page.goto(BASE + "/client")
    client_page.get_by_label("Client email").fill(client["email"])
    client_page.get_by_label("Password", exact=True).fill(
        "browser-test-password"
    )
    client_page.get_by_role("button", name="Sign in", exact=True).click()
    expect(client_page).to_have_url(BASE + "/client/home")
    client_page.goto(BASE + "/client/enquiries/" + enquiry["_id"])
    expect(
        client_page.get_by_role("heading", name="Booking preparation").locator("..")
    ).to_contain_text("Proposal cancelled")
    assert client_context.request.get(BASE + "/api/studio/booking-drafts").status == 401
    for width in (320, 390, 768):
        page.set_viewport_size({"width": width, "height": 900})
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    browser.close()
print("Booking proposal browser workflow passed")
