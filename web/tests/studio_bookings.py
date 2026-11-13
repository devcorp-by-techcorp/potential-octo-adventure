"""Real booking planning, rescheduling, conflict recovery and lifecycle regressions."""

import os
import re
import tempfile
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
    db.bookings.delete_many({})
    db.staff_login_limits.delete_many({})
    db.staff_identities.update_one(
        {"_id": "browser-staff"}, {"$set": {"enabled": True, "role": "staff"}}
    )
    identity = db.staff_identities.find_one({"_id": "browser-staff"})
    db.staff_identities.replace_one(
        {"_id": "booking-second"},
        {**identity, "_id": "booking-second", "email": "booking-second@example.test"},
        upsert=True,
    )
    browser = playwright.chromium.launch(
        executable_path="/usr/bin/chromium"
        if Path("/usr/bin/chromium").exists()
        else None,
        headless=True,
    )
    errors = []
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))

    def sign_in(target, email="staff@example.test"):
        target.goto(BASE + "/studio")
        target.get_by_label("Staff email").fill(email)
        target.get_by_label("Password", exact=True).fill(PASSWORD)
        with target.expect_response(
            lambda response: response.url.endswith("/api/auth/login")
        ) as login_response:
            target.get_by_role("button", name="Sign in", exact=True).click()
        assert login_response.value.status == 200, login_response.value.text()
        expect(target).to_have_url(BASE + "/studio/home")

    def service_failure(route):
        route.fulfill(
            status=503,
            json={
                "detail": "Studio access is temporarily unavailable. Please try again."
            },
        )

    def save(target):
        with target.expect_response(
            lambda response: response.request.method == "PATCH"
            and response.url == BASE + "/api" + target.url.removeprefix(BASE)
        ) as saved_response:
            target.get_by_role("button", name="Save booking details", exact=True).click()
        assert saved_response.value.status == 200, saved_response.value.text()
        expect(target.get_by_role("status")).to_have_text("Booking details saved.")

    # Direct private routes require authentication, and the empty list is real.
    page.goto(BASE + "/studio/bookings/" + str(uuid4()))
    expect(page).to_have_url(BASE + "/studio")
    sign_in(page)
    with page.expect_response("**/api/studio/bookings") as empty_bookings:
        page.get_by_role("link", name="Bookings & tracker", exact=True).click()
    assert empty_bookings.value.status == 200, empty_bookings.value.text()
    expect(page.get_by_role("status")).to_contain_text("No planning bookings yet")

    # Submit an actual public enquiry and convert it through the staff UI twice.
    page.goto(BASE)
    page.get_by_role("button", name="Enquire about Essentials", exact=True).click()
    page.locator("[name=name]").fill("Booking Planning Customer")
    page.locator("[name=email]").fill("booking-planning@example.test")
    page.locator("[name=preferred_date]").fill("2099-12-20")
    page.get_by_role("checkbox").check()
    page.get_by_role("button", name="Send enquiry", exact=True).click()
    expect(page.get_by_role("dialog")).to_contain_text("Reference: IS-")
    reference = re.search(
        r"IS-[A-F0-9]{12}", page.get_by_role("dialog").inner_text()
    ).group()
    enquiry = db.booking_requests.find_one({"reference": reference})
    page.goto(BASE + "/studio/enquiries/" + enquiry["_id"])
    for _ in range(2):
        with page.expect_response(
            f"**/api/studio/enquiries/{enquiry['_id']}/booking"
        ) as create_response:
            page.get_by_role("button", name="Create planning booking", exact=True).click()
        assert create_response.value.status == 200, create_response.value.text()
        expect(
            page.get_by_role("link", name=f"Open {reference} booking", exact=True)
        ).to_be_visible()
        expect(
            page.get_by_role("button", name="Create planning booking", exact=True)
        ).to_be_enabled()
    assert db.bookings.count_documents({"source_enquiry_id": enquiry["_id"]}) == 1
    page.get_by_role("link", name=f"Open {reference} booking", exact=True).click()
    booking = db.bookings.find_one({"source_enquiry_id": enquiry["_id"]})
    booking_url = BASE + "/studio/bookings/" + booking["_id"]
    api_path = BASE + "/api/studio/bookings/" + booking["_id"]
    expect(page.get_by_label("Planned date")).to_have_value("2099-12-20")
    expect(page.get_by_role("heading", name=reference, exact=True)).to_be_focused()
    assert booking["state"] == "planning" and booking["revision"] == 0

    # Unsaved edits cannot be accidentally discarded by a stage change.
    page.get_by_label("Planned date").fill("2028-02-29")
    page.get_by_label("Location", exact=True).fill("Melbourne studio")
    page.get_by_label("Private staff note").fill(
        "Staff-only planning <b>plain text</b>"
    )
    expect(
        page.get_by_role("button", name="Confirmation unavailable", exact=True)
    ).to_be_disabled()
    expect(
        page.get_by_text(
            "Confirmation is unavailable until resource capacity, scheduling, approval, contract and payment checks are implemented.",
            exact=False,
        )
    ).to_be_visible()
    expect(
        page.get_by_role("button", name="Cancel booking", exact=True)
    ).to_be_disabled()
    save(page)
    page.reload()
    expect(page.get_by_label("Planned date")).to_have_value("2028-02-29")
    expect(page.get_by_label("Location", exact=True)).to_have_value("Melbourne studio")
    expect(page.get_by_label("Private staff note")).to_have_value(
        "Staff-only planning <b>plain text</b>"
    )
    page.get_by_label("Private staff note").fill("Discard this draft")
    page.get_by_role("button", name="Discard detail changes").click()
    expect(page.get_by_label("Private staff note")).to_have_value(
        "Staff-only planning <b>plain text</b>"
    )

    # Two real staff sessions compete at the same revision; the losing draft survives.
    second_context = browser.new_context()
    second = second_context.new_page()
    second.on("pageerror", lambda error: errors.append(str(error)))
    sign_in(second, "booking-second@example.test")
    second.goto(booking_url)
    expect(second.get_by_label("Private staff note")).to_have_value(
        "Staff-only planning <b>plain text</b>"
    )
    page.get_by_label("Private staff note").fill("First staff saved note")
    save(page)
    second.get_by_label("Private staff note").fill("Second staff retained draft")
    second.get_by_role("button", name="Save booking details", exact=True).click()
    expect(second.get_by_role("alert")).to_contain_text("changed")
    expect(second.get_by_label("Private staff note")).to_have_value(
        "Second staff retained draft"
    )
    expect(
        second.get_by_role("button", name="Save booking details", exact=True)
    ).to_be_disabled()
    assert (
        db.bookings.find_one({"_id": booking["_id"]})["staff_note"]
        == "First staff saved note"
    )
    second.get_by_role("button", name="Review latest saved version").click()
    expect(second.get_by_text("First staff saved note", exact=True)).to_be_visible()
    second.get_by_role("button", name="Keep my draft against this revision").click()
    expect(second.get_by_label("Private staff note")).to_be_focused()
    second.keyboard.press("Tab")
    expect(
        second.get_by_role("button", name="Save booking details", exact=True)
    ).to_be_focused()
    with second.expect_response(
        lambda response: response.request.method == "PATCH" and response.url == api_path
    ) as keyboard_save:
        second.keyboard.press("Enter")
    assert keyboard_save.value.status == 200, keyboard_save.value.text()
    expect(second.get_by_role("status")).to_have_text("Booking details saved.")
    assert db.bookings.find_one({"_id": booking["_id"]})["revision"] == 3
    second_context.close()
    page.reload()
    expect(page.get_by_label("Private staff note")).to_have_value(
        "Second staff retained draft"
    )

    # A failed save preserves the draft, and a lost response cannot duplicate a write.
    page.route(api_path, service_failure)
    page.get_by_label("Private staff note").fill("Draft during outage")
    page.get_by_role("button", name="Save booking details", exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    expect(page.get_by_label("Private staff note")).to_have_value("Draft during outage")
    assert not page.get_by_text("Booking details saved.", exact=True).count()
    page.unroute(api_path)
    save(page)

    def lost_response(route):
        if route.request.method == "PATCH":
            assert route.fetch().status == 200
            service_failure(route)
        else:
            route.continue_()

    page.route(api_path, lost_response)
    page.get_by_label("Private staff note").fill("Committed despite lost response")
    page.get_by_role("button", name="Save booking details", exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    assert db.bookings.find_one({"_id": booking["_id"]})["revision"] == 5
    page.unroute(api_path)
    page.get_by_role("button", name="Save booking details", exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("changed")
    page.get_by_role("button", name="Review latest saved version").click()
    expect(
        page.get_by_label("Reconcile booking changes").get_by_text(
            "Committed despite lost response", exact=True
        )
    ).to_be_visible()
    page.get_by_role("button", name="Use saved booking details").click()
    expect(
        page.get_by_role("button", name="Save booking details", exact=True)
    ).to_be_disabled()
    assert db.bookings.find_one({"_id": booking["_id"]})["revision"] == 5

    # Confirmation stays unavailable until the approved scheduling and obligation gates are implemented.
    expect(page.get_by_role("button", name="Confirmation unavailable", exact=True)).to_be_disabled()
    for action, state in [
        ("Cancel booking", "cancelled"),
        ("Reopen to planning", "planning"),
    ]:
        with page.expect_response(
            lambda response: response.request.method == "PATCH" and response.url == api_path
        ) as transition:
            page.get_by_role("button", name=action, exact=True).click()
        assert transition.value.status == 200, transition.value.text()
        expect(page.get_by_role("status")).to_contain_text("Booking moved to")
        saved = db.bookings.find_one({"_id": booking["_id"]})
        assert saved["state"] == state and saved["history"][-1]["to"] == state
        assert saved["history"][-1]["actor_id"] == "browser-staff"
    expect(page.get_by_role("button", name="Cancel booking", exact=True)).to_be_enabled()
    assert len(saved["history"]) == 3
    assert db.booking_requests.find_one({"_id": enquiry["_id"]}) == enquiry

    # Stale saved theme choices cannot darken ordinary routes; narrow widths retain usable inputs.
    for theme in ["light", "dark"]:
        page.evaluate("theme => localStorage.setItem('illuminate-theme', theme)", theme)
        page.reload()
        expect(page.locator("body")).to_have_attribute("data-theme", "light")
        page.get_by_role("button", name="Review latest saved version").click()
        expect(page.get_by_role("heading", name="Latest saved booking")).to_be_visible()
        for width in [320, 390, 768, 1024, 1440]:
            page.set_viewport_size({"width": width, "height": 900})
            assert not page.evaluate(
                "document.documentElement.scrollWidth > innerWidth"
            ), (theme, width)
        page.set_viewport_size({"width": 390, "height": 900})
        page.screenshot(
            path=str(
                Path(tempfile.gettempdir()) / f"studio-booking-recovery-{theme}.png"
            ),
            full_page=True,
        )
    page.get_by_role("button", name="Use saved booking details").click()

    # Recovery controls distinguish unavailable, absent and invalid bookings.
    page.route(api_path, service_failure)
    page.reload()
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    assert not page.get_by_label("Private staff note").count()
    page.unroute(api_path)
    page.get_by_role("button", name="Try again", exact=True).click()
    expect(page.get_by_label("Private staff note")).to_be_visible()
    page.goto(BASE + "/studio/bookings/" + str(uuid4()))
    expect(page.get_by_role("status")).to_have_text("Booking not found.")
    page.goto(BASE + "/studio/bookings/invalid")
    expect(page.get_by_role("alert")).to_contain_text("This booking link is invalid")
    page.route(BASE + "/api/studio/bookings", service_failure)
    page.goto(BASE + "/studio/bookings")
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    page.unroute(BASE + "/api/studio/bookings")
    page.get_by_role("button", name="Try again", exact=True).click()
    expect(page.get_by_role("link", name=re.compile(reference))).to_be_visible()

    # Invalidate only once the browser has sent a real save, avoiding a
    # count-then-click race with background private-content clearing. No denial
    # response is mocked: the running application's authorization rejects it.
    def denial_handler(change):
        def invalidate_save(route):
            if route.request.method == "PATCH":
                if change in {"disabled", "role", "reset"}:
                    changes = {
                        "disabled": {"enabled": False},
                        "role": {"role": "client"},
                        "reset": {"auth_version": "browser-reset"},
                    }
                    db.staff_identities.update_one(
                        {"_id": "browser-staff"}, {"$set": changes[change]}
                    )
                else:
                    changes = (
                        {"expires_at": datetime.now(UTC) - timedelta(seconds=1)}
                        if change == "expired"
                        else {"revoked_at": datetime.now(UTC)}
                    )
                    db.staff_sessions.update_many(
                        {"identity_id": "browser-staff"}, {"$set": changes}
                    )
            route.continue_()

        return invalidate_save

    for change in ("revoked", "disabled", "role", "reset", "expired"):
        if change != "revoked":
            db.staff_login_limits.delete_many({})
            sign_in(page)
        page.goto(booking_url)
        expect(page.get_by_label("Private staff note")).to_be_visible()
        page.get_by_label("Private staff note").fill("Unsaved private draft")
        before_denial = db.bookings.find_one({"_id": booking["_id"]})

        invalidate_save = denial_handler(change)
        page.route(api_path, invalidate_save)
        with page.expect_response(
            lambda response: response.url == api_path
            and response.request.method == "PATCH"
        ) as denied_save:
            page.get_by_role("button", name="Save booking details", exact=True).click()
        assert denied_save.value.status in (401, 403), denied_save.value.text()
        denied_identity = db.staff_identities.find_one({"_id": "browser-staff"})
        if change == "disabled":
            assert denied_identity["enabled"] is False
        elif change == "role":
            assert denied_identity["role"] == "client"
        elif change == "reset":
            assert denied_identity["auth_version"] == "browser-reset"
        else:
            if change == "expired":
                # TTL may already have removed expired records; it must never
                # leave an unexpired session, and is not the authorization check.
                assert db.staff_sessions.count_documents({
                    "identity_id": "browser-staff", "expires_at": {"$gt": datetime.now(UTC)}
                }) == 0
            else:
                assert db.staff_sessions.count_documents({
                    "identity_id": "browser-staff", "revoked_at": None
                }) == 0
        page.unroute(api_path, invalidate_save)
        assert db.bookings.find_one({"_id": booking["_id"]}) == before_denial
        assert db.booking_requests.find_one({"_id": enquiry["_id"]}) == enquiry
        expect(page).to_have_url(BASE + "/studio")
        try:
            expect(page.get_by_label("Staff email")).to_be_visible()
        except AssertionError:
            artifact = Path(os.getenv("ENTRY_TEST_ARTIFACTS", tempfile.gettempdir()))
            artifact.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(artifact / f"booking-denial-{change}.png"))
            (artifact / f"booking-denial-{change}.txt").write_text(page.content())
            print(f"Booking denial render failure: {change}; URL {page.url}", flush=True)
            raise
        assert not page.get_by_label("Private staff note").count()
        assert reference not in page.locator("body").inner_text()
        db.staff_identities.update_one(
            {"_id": "browser-staff"},
            {"$set": {
                "enabled": True, "role": "staff", "auth_version": identity["auth_version"]
            }},
        )
        context.clear_cookies()
    assert not errors, errors
    print(
        "studio bookings: public enquiry → idempotent planning → reschedule → two-staff recovery → lost response → cancel/reopen; confirmation policy gate, privacy, recovery, themes/five widths; zero page errors/overflow"
    )
    browser.close()
