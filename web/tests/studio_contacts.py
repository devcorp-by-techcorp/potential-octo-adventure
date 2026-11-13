"""Real canonical contact roster and explicit enquiry links through the staff UI."""

import os
import sys
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from auth import password_hash

BASE = os.getenv("ENTRY_TEST_URL", "http://127.0.0.1:5173")
with MongoClient(os.environ["BROWSER_MONGODB_URI"]) as mongo, sync_playwright() as p:
    db = mongo.studio_suite_browser_test
    db.staff_login_limits.delete_many({})
    db.staff_identities.update_one(
        {"_id": "browser-staff"}, {"$set": {"enabled": True}}
    )
    client = {
        "_id": str(uuid4()),
        "email": "contacts-client@example.test",
        "name": "Contacts Test Client",
        "role": "client",
        "enabled": True,
        "auth_version": str(uuid4()),
        "password_hash": password_hash("browser-test-password"),
    }
    db.client_identities.insert_one(client)
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "/studio")
    page.get_by_label("Staff email").fill("staff@example.test")
    page.get_by_label("Password", exact=True).fill("browser-test-password")
    page.get_by_role("button", name="Sign in", exact=True).click()
    expect(page).to_have_url(BASE + "/studio/home")
    page.get_by_role("link", name="Client contacts", exact=True).click()
    expect(page.get_by_role("status")).to_contain_text("client contacts on this page")
    with page.expect_response(
        lambda response: response.request.method == "GET"
        and response.url.endswith("/api/studio/contacts/" + client["_id"])
    ) as detail_response:
        page.get_by_role(
            "button", name=client["name"] + " · " + client["email"], exact=True
        ).click()
    assert detail_response.value.status == 200, detail_response.value.text()
    expect(page.get_by_role("button", name="Back to contacts")).to_be_visible()
    assert "password_hash" not in page.locator("body").inner_text()
    page.get_by_role("button", name="Back to contacts").click()
    page.reload()
    expect(page.get_by_role("status")).to_contain_text("client contacts on this page")
    denied = browser.new_context()
    assert denied.request.get(BASE + "/api/studio/contacts").status == 401
    assert not errors, errors
    browser.close()
print("Canonical contacts browser workflow passed")
