"""Real resource configuration, uncertain delivery, revision conflict and denial."""

import os
import sys
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from auth import password_hash

BASE = os.getenv("ENTRY_TEST_URL", "http://127.0.0.1:5173")
API = BASE + "/api/studio/booking-resources"


def sign_in(page):
    page.goto(BASE + "/studio")
    page.get_by_label("Staff email").fill("staff@example.test")
    page.get_by_label("Password", exact=True).fill("browser-test-password")
    with page.expect_response(lambda r: r.url.endswith("/api/auth/login")) as response:
        page.get_by_role("button", name="Sign in", exact=True).click()
    assert response.value.status == 200
    expect(page).to_have_url(BASE + "/studio/home")


def load(page, click=False):
    with page.expect_response(
        lambda r: r.url == API and r.request.method == "GET"
    ) as response:
        if click:
            page.get_by_role("button", name="Refresh resources", exact=True).click()
        else:
            page.goto(BASE + "/studio/booking-resources")
    assert response.value.status == 200, response.value.text()
    expect(
        page.get_by_role("button", name="Refresh resources", exact=True)
    ).to_be_enabled()


with MongoClient(os.environ["BROWSER_MONGODB_URI"]) as mongo, sync_playwright() as p:
    db = mongo.studio_suite_browser_test
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page, other = context.new_page(), context.new_page()
    errors = []
    for current in (page, other):
        current.on("pageerror", lambda error: errors.append(str(error)))
    sign_in(page)
    load(page)
    region = page.get_by_role("region", name="Booking resource configuration")
    expect(region.get_by_text("No resources configured.", exact=True)).to_be_visible()
    assert db.bookings.count_documents({}) == 0
    page.get_by_label("Resource name", exact=True).fill(
        "Resource <script>literal</script>"
    )
    creation = {}

    def lose_response(route):
        if route.request.method == "POST":
            creation.update(route.request.post_data_json)
            response = route.fetch()
            assert response.status == 200
            route.abort("failed")
        else:
            route.continue_()

    page.route(API, lose_response)
    page.get_by_role("button", name="Create resource", exact=True).click()
    expect(region.get_by_role("alert")).to_contain_text("Retry the same creation")
    expect(page.get_by_label("Resource name", exact=True)).to_have_attribute(
        "readonly", ""
    )
    stored = db.booking_resources.find_one({"_id": creation["id"]})
    assert stored["capacity"] == 1 and len(stored["history"]) == 1
    page.unroute(API, lose_response)
    with (
        page.expect_response(
            lambda r: r.url == API and r.request.method == "POST"
        ) as retry,
        page.expect_response(
            lambda r: r.url == API and r.request.method == "GET"
        ) as refresh,
    ):
        page.get_by_role("button", name="Retry same creation", exact=True).click()
    assert retry.value.status == refresh.value.status == 200
    assert retry.value.json()["id"] == creation["id"]
    expect(
        page.get_by_role("button", name="Refresh resources", exact=True)
    ).to_be_enabled()
    expect(
        region.get_by_text("Resource saved: " + creation["name"] + ".", exact=True)
    ).to_be_visible()
    assert db.booking_resources.count_documents({}) == 1
    assert len(db.booking_resources.find_one({})["history"]) == 1
    assert page.locator("script").filter(has_text="literal").count() == 0
    load(other)
    other.get_by_role("button", name="Edit " + creation["name"], exact=True).click()
    page.get_by_role("button", name="Edit " + creation["name"], exact=True).click()
    page.get_by_label("Resource name", exact=True).fill("Configured room")
    page.get_by_label("Resource capacity", exact=True).fill("2")
    path = API + "/" + creation["id"]
    with page.expect_response(
        lambda r: r.url == path and r.request.method == "PATCH"
    ) as saved:
        page.get_by_role("button", name="Save resource changes", exact=True).click()
    assert saved.value.status == 200 and saved.value.json()["revision"] == 1
    expect(
        region.get_by_text("Resource saved: Configured room.", exact=True)
    ).to_be_visible()
    other.get_by_label("Resource name", exact=True).fill("Stale overwrite")
    with other.expect_response(
        lambda r: r.url == path and r.request.method == "PATCH"
    ) as conflict:
        other.get_by_role("button", name="Save resource changes", exact=True).click()
    assert conflict.value.status == 409
    expect(other.get_by_role("alert")).to_contain_text("This resource changed")
    assert db.booking_resources.find_one({})["name"] == "Configured room"
    load(other, click=True)
    other.get_by_role("button", name="Edit Configured room", exact=True).click()
    other.get_by_label("Resource enabled", exact=False).uncheck()
    with other.expect_response(
        lambda r: r.url == path and r.request.method == "PATCH"
    ) as saved:
        other.get_by_role("button", name="Save resource changes", exact=True).click()
    assert saved.value.status == 200 and saved.value.json()["revision"] == 2
    load(page)
    expect(
        region.get_by_text(
            "Photographer · Capacity 2 · Disabled · Revision 2", exact=True
        )
    ).to_be_visible()

    # Client authentication is real; a client cookie cannot authorize resource access.
    db.client_identities.insert_one(
        {
            "_id": str(uuid4()),
            "email": "resource-client@example.test",
            "name": "Resource Client",
            "role": "client",
            "enabled": True,
            "auth_version": str(uuid4()),
            "password_hash": password_hash("browser-test-password"),
        }
    )
    outsider = browser.new_context()
    client = outsider.new_page()
    client.goto(BASE + "/client")
    client.get_by_label("Client email").fill("resource-client@example.test")
    client.get_by_label("Password", exact=True).fill("browser-test-password")
    with client.expect_response(
        lambda r: r.url.endswith("/api/auth/client/login")
    ) as signed_in:
        client.get_by_role("button", name="Sign in", exact=True).click()
    assert signed_in.value.status == 200
    assert outsider.request.get(API).status == 401
    assert (
        outsider.request.post(
            API,
            data=creation,
            headers={
                "Origin": BASE,
                "X-CSRF-Token": signed_in.value.json()["csrf_token"],
            },
        ).status
        == 401
    )

    for width in (320, 390, 768, 1440):
        page.set_viewport_size({"width": width, "height": 900})
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
    page.get_by_role("button", name="Edit Configured room", exact=True).click()
    page.get_by_label("Resource name", exact=True).fill("Denied write")
    before = db.booking_resources.find_one({})

    def disable(route):
        if route.request.method == "PATCH":
            db.staff_identities.update_one(
                {"_id": "browser-staff"}, {"$set": {"enabled": False}}
            )
        route.continue_()

    page.route(path, disable)
    with page.expect_response(
        lambda r: r.url == path and r.request.method == "PATCH"
    ) as denial:
        page.get_by_role("button", name="Save resource changes", exact=True).click()
    assert denial.value.status == 401
    assert db.booking_resources.find_one({}) == before
    expect(page.get_by_label("Staff email")).to_be_visible()
    expect(page.get_by_text("Configured room", exact=True)).to_have_count(0)
    db.staff_identities.update_one(
        {"_id": "browser-staff"}, {"$set": {"enabled": True}}
    )
    assert (
        db.bookings.count_documents({}) == db.booking_requests.count_documents({}) == 0
    )
    assert db.client_access.count_documents({}) == 0
    assert not errors, errors
    browser.close()
print(
    "Booking resources browser: real persistence, lost-response exact retry, revision conflict/recovery, disable, client denial, authorization loss and four widths passed"
)
