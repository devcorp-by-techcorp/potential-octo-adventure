"""Phase 2 real public/API/MongoDB flow; browser interception is failures only."""

import json
import os
import re
import sys
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright
from pymongo import MongoClient

BASE = os.getenv("ENTRY_TEST_URL", "http://127.0.0.1:5173")
PASSWORD = "browser-test-password"
WIDTHS = [320, 390, 768, 1024, 1440]

with (
    MongoClient(os.environ["BROWSER_MONGODB_URI"]) as mongo,
    sync_playwright() as playwright,
):
    db = mongo["studio_suite_browser_test"]
    db.booking_requests.delete_many({})
    db.staff_login_limits.delete_many({})
    identity = db.staff_identities.find_one({"_id": "browser-staff"})
    db.staff_identities.replace_one(
        {"_id": "browser-second"},
        {
            **identity,
            "_id": "browser-second",
            "email": "second@example.test",
            "name": "Second Staff",
        },
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
    network = []

    def trace_response(response):
        if "/api/" in response.url:
            network.append(
                {"path": urlsplit(response.url).path, "status": response.status}
            )
            del network[:-20]

    page.on("response", trace_response)

    def sign_in(target=page, email="staff@example.test"):
        target.get_by_label("Staff email").fill(email)
        target.get_by_label("Password", exact=True).fill(PASSWORD)
        with target.expect_response(
            lambda response: response.url.endswith("/api/auth/login")
        ) as login_response:
            target.get_by_role("button", name="Sign in", exact=True).click()
        assert login_response.value.status == 200, login_response.value.text()
        expect(target).to_have_url(BASE + "/studio/home", timeout=15_000)
        expect(target.get_by_text("Signed in as " + email)).to_be_visible()

    def inbox(target=page):
        with target.expect_response(
            lambda response: (
                response.request.method == "GET"
                and response.url.split("?")[0].endswith("/api/studio/enquiries")
            )
        ) as inbox_response:
            target.get_by_role("link", name="Enquiry inbox", exact=True).click()
        assert inbox_response.value.status == 200, inbox_response.value.text()
        expect(
            target.get_by_role("heading", name="Enquiry inbox", exact=True)
        ).to_be_visible()
        # The heading appears before the list request finishes and restores focus.
        # Wait for that transition before interacting with the filter controls.
        expect(target.get_by_role("status")).to_contain_text(
            re.compile(r"No enquiries|enquiries on this page")
        )
        expect(
            target.get_by_role("heading", name="Enquiry inbox", exact=True)
        ).to_be_focused()

    def filter_by(status, limit="25"):
        page.get_by_label("Filter by status").select_option(status)
        page.get_by_label("Enquiries per page").select_option(limit)
        page.get_by_role("button", name="Apply filter").click()

    def no_overflow(target=page):
        for width in WIDTHS:
            target.set_viewport_size({"width": width, "height": 844})
            assert not target.evaluate(
                "document.documentElement.scrollWidth > innerWidth"
            ), width

    def service_failure(route):
        route.fulfill(
            status=503,
            json={
                "detail": "Studio access is temporarily unavailable. Please try again."
            },
        )

    # Direct list and detail routes restore authorization before showing private data.
    for route in ["/studio/enquiries", "/studio/enquiries/" + str(uuid4())]:
        page.goto(BASE + route)
        expect(page).to_have_url(BASE + "/studio")
        expect(page.get_by_label("Staff email")).to_be_visible()
    page.evaluate('localStorage.setItem("illuminate-theme", "dark")')
    sign_in()
    inbox()
    expect(page.get_by_role("status")).to_contain_text("No enquiries yet")
    filter_by("archived")
    expect(page.get_by_role("status")).to_contain_text("No enquiries match this filter")
    no_overflow()

    # Submit through the public UI, then find the identical persisted reference.
    page.goto(BASE)
    page.get_by_role("button", name="Enquire about Essentials", exact=True).click()
    page.locator("[name=name]").fill("Inbox Public Customer")
    page.locator("[name=email]").fill("inbox-customer@example.test")
    page.locator("[name=preferred_date]").fill("2099-12-20")
    page.locator("[name=message]").fill("Original customer message <b>plain text</b>")
    page.get_by_role("checkbox").check()
    with page.expect_response(
        lambda response: (
            response.url.endswith("/api/bookings") and response.request.method == "POST"
        )
    ) as submission:
        page.get_by_role("button", name="Send enquiry", exact=True).click()
    assert submission.value.status == 201, submission.value.text()
    expect(page.get_by_role("dialog")).to_contain_text("Reference: IS-")
    reference = re.search(
        r"IS-[A-F0-9]{12}", page.get_by_role("dialog").inner_text()
    ).group()
    saved = db.booking_requests.find_one({"reference": reference})
    assert saved and saved["studio_revision"] == 0
    enquiry_url = BASE + "/studio/enquiries/" + saved["_id"]
    page.goto(BASE + "/studio/home")
    inbox()
    expect(page.get_by_role("link", name=re.compile(reference))).to_be_visible()
    no_overflow()
    page.get_by_role("link", name=re.compile(reference)).click()
    expect(page.get_by_label("Private studio note")).to_have_value("")
    assert db.booking_requests.find_one({"_id": saved["_id"]}) == saved
    expect(page.get_by_text("20/12/2099", exact=True)).to_be_visible()
    expect(
        page.get_by_text("Original customer message <b>plain text</b>", exact=True)
    ).to_be_visible()
    assert not page.locator(".enquiry-details b").count()
    no_overflow()
    page.set_viewport_size({"width": 320, "height": 844})
    page.screenshot(
        path=str(Path(tempfile.gettempdir()) / "studio-inbox-detail-mobile.png")
    )
    expect(page.locator("body")).to_have_attribute("data-theme", "light")
    page.set_viewport_size({"width": 1440, "height": 900})

    # Editing and saving via keyboard goes through the real PATCH handler.
    page.get_by_label("Internal status").focus()
    page.keyboard.press("ArrowDown")
    page.keyboard.press("Tab")
    expect(page.get_by_label("Private studio note")).to_be_focused()
    page.keyboard.type("Shared private note <script>text only</script>")
    page.keyboard.press("Tab")
    expect(page.get_by_role("button", name="Save changes")).to_be_focused()
    with page.expect_response(
        lambda response: (
            response.request.method == "PATCH"
            and response.url.endswith("/api/studio/enquiries/" + saved["_id"])
        )
    ) as save_response:
        page.keyboard.press("Enter")
    assert save_response.value.status == 200, save_response.value.text()
    expect(page.get_by_role("status").filter(has_text="Changes saved")).to_be_visible()
    updated = db.booking_requests.find_one({"_id": saved["_id"]})
    assert updated["studio_revision"] == 1 and updated["studio_status"] == "in_review"
    assert updated["studio_updated_by"] == "browser-staff"
    assert updated["state"] == "awaiting_studio_confirmation"
    assert {key: updated[key] for key in saved if not key.startswith("studio_")} == {
        key: value for key, value in saved.items() if not key.startswith("studio_")
    }
    page.reload()
    expect(page.get_by_label("Private studio note")).to_have_value(
        updated["studio_note"]
    )
    expect(page.get_by_label("Internal status")).to_have_value("in_review")
    expect(page.locator("body")).to_have_attribute("data-theme", "light")

    # A new authenticated identity sees shared persisted edits, then competes at N.
    second_context = browser.new_context()
    second = second_context.new_page()
    second.on("pageerror", lambda error: errors.append(str(error)))
    second.goto(BASE + "/studio")
    sign_in(second, "second@example.test")
    second.goto(enquiry_url)
    expect(second.get_by_label("Private studio note")).to_have_value(
        updated["studio_note"]
    )
    page.get_by_label("Private studio note").fill("First staff wins")
    page.get_by_role("button", name="Save changes").click()
    expect(page.get_by_role("status")).to_contain_text("Changes saved")
    second.get_by_label("Private studio note").fill("Second staff draft retained")
    second.get_by_role("button", name="Save changes").click()
    expect(second.get_by_role("alert")).to_contain_text("changed")
    expect(second.get_by_label("Private studio note")).to_have_value(
        "Second staff draft retained"
    )
    assert (
        db.booking_requests.find_one({"_id": saved["_id"]})["studio_note"]
        == "First staff wins"
    )
    second.get_by_role("button", name="Review latest saved version").click()
    expect(second.get_by_text("First staff wins", exact=True)).to_be_visible()
    second.get_by_role("button", name="Keep my draft against this revision").click()
    expect(second.get_by_label("Private studio note")).to_be_focused()
    second.get_by_role("button", name="Save changes").click()
    expect(second.get_by_role("status")).to_contain_text("Changes saved")
    assert db.booking_requests.find_one({"_id": saved["_id"]})["studio_revision"] == 3
    assert (
        db.booking_requests.find_one({"_id": saved["_id"]})["studio_updated_by"]
        == "browser-second"
    )
    second_context.close()

    # Failed writes retain draft and cannot display a successful-save announcement.
    page.reload()
    expect(page.get_by_label("Private studio note")).to_have_value(
        "Second staff draft retained"
    )
    page.route("**/api/studio/enquiries/*", service_failure)
    page.get_by_label("Private studio note").fill("Draft through outage")
    page.get_by_role("button", name="Save changes").click()
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    expect(page.get_by_label("Private studio note")).to_have_value(
        "Draft through outage"
    )
    assert not page.get_by_text("Changes saved.", exact=True).count()
    assert db.booking_requests.find_one({"_id": saved["_id"]})["studio_revision"] == 3
    page.unroute("**/api/studio/enquiries/*")
    page.get_by_role("button", name="Review latest saved version").click()
    expect(page.get_by_text("Second staff draft retained", exact=True)).to_be_visible()
    page.get_by_role("button", name="Use saved status and note").click()
    expect(page.get_by_label("Private studio note")).to_have_value(
        "Second staff draft retained"
    )

    # Simulate a response lost after a real successful write: retry cannot duplicate it.
    def uncertain_write(route):
        if route.request.method == "PATCH":
            response = route.fetch()
            assert response.status == 200
            service_failure(route)
        else:
            route.continue_()

    page.route("**/api/studio/enquiries/*", uncertain_write)
    page.get_by_label("Private studio note").fill("Uncertain save persisted once")
    page.get_by_role("button", name="Save changes").click()
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    expect(page.get_by_label("Private studio note")).to_have_value(
        "Uncertain save persisted once"
    )
    assert not page.get_by_text("Changes saved.", exact=True).count()
    assert db.booking_requests.find_one({"_id": saved["_id"]})["studio_revision"] == 4
    page.unroute("**/api/studio/enquiries/*")
    page.get_by_role("button", name="Save changes").click()
    expect(page.get_by_role("alert")).to_contain_text("changed")
    page.get_by_role("button", name="Review latest saved version").click()
    expect(page.locator(".saved-note")).to_have_text("Uncertain save persisted once")
    page.get_by_role("button", name="Use saved status and note").click()

    # Archive and reopen, retaining the record and the pending customer state.
    page.get_by_label("Internal status").select_option("archived")
    page.get_by_role("button", name="Save changes").click()
    expect(page.get_by_role("status")).to_contain_text("Changes saved")
    inbox()
    filter_by("archived")
    page.get_by_role("link", name=re.compile(reference)).click()
    expect(page.get_by_label("Internal status")).to_have_value("archived")
    page.get_by_label("Internal status").select_option("new")
    page.get_by_role("button", name="Save changes").click()
    expect(page.get_by_role("status")).to_contain_text("Changes saved")

    # Pagination with real legacy records, keyboard filtering and focus restoration.
    for index in range(2):
        legacy = {
            key: value for key, value in saved.items() if not key.startswith("studio_")
        }
        db.booking_requests.insert_one(
            {**legacy, "_id": str(uuid4()), "reference": f"IS-PAGE-{index}"}
        )
    inbox()
    page.get_by_label("Filter by status").focus()
    page.get_by_label("Filter by status").select_option("new")
    page.keyboard.press("Tab")
    expect(page.get_by_label("Enquiries per page")).to_be_focused()
    page.get_by_label("Enquiries per page").select_option("1")
    page.keyboard.press("Tab")
    expect(page.get_by_role("button", name="Apply filter")).to_be_focused()
    page.keyboard.press("Enter")
    expect(page.get_by_role("status")).to_contain_text("1 enquiries")
    expect(
        page.get_by_role("heading", name="Enquiry inbox", exact=True)
    ).to_be_focused()
    first_id = page.locator(".enquiry-link").get_attribute("href")
    page.get_by_role("button", name="Next page").click()
    expect(page.get_by_role("button", name="First page")).to_be_visible()
    # Cursor controls can render before the requested page replaces the old row.
    expect(page.locator(".enquiry-link")).not_to_have_attribute("href", first_id)
    expect(
        page.get_by_role("heading", name="Enquiry inbox", exact=True)
    ).to_be_focused()
    page.get_by_role("button", name="First page").click()
    expect(page.locator(".enquiry-link")).to_have_attribute("href", first_id)

    # List and detail service recovery, missing/invalid routes and invalid cursor.
    page.route("**/api/studio/enquiries?*", service_failure)
    page.reload()
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    assert not page.get_by_text("No enquiries yet.", exact=True).count()
    page.unroute("**/api/studio/enquiries?*")
    page.get_by_role("button", name="Try again", exact=True).click()
    expect(page.locator(".enquiry-link")).to_be_visible()
    page.route("**/api/studio/enquiries/*", service_failure)
    page.goto(enquiry_url)
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    assert not page.get_by_label("Private studio note").count()
    page.unroute("**/api/studio/enquiries/*")
    page.get_by_role("button", name="Try again", exact=True).click()
    expect(page.get_by_label("Private studio note")).to_be_visible()
    page.goto(BASE + "/studio/enquiries/" + str(uuid4()))
    expect(page.get_by_role("status")).to_contain_text("Enquiry not found")
    page.goto(BASE + "/studio/enquiries/invalid")
    expect(page.get_by_role("alert")).to_contain_text("check the enquiry input")
    page.goto(BASE + "/studio/enquiries?cursor=invalid")
    expect(page.get_by_role("alert")).to_contain_text("Invalid enquiry cursor")
    with page.expect_response(
        lambda response: (
            response.request.method == "GET"
            and response.url.endswith("/api/studio/enquiries?limit=25")
        )
    ) as reset_response:
        page.get_by_role("button", name="Reset filters").click()
    assert reset_response.value.status == 200, reset_response.value.text()
    expect(page.locator(".enquiry-link")).to_have_count(3)

    # Light theme also restores for protected direct navigation at every width.
    page.evaluate('localStorage.setItem("illuminate-theme", "light")')
    page.reload()
    expect(page.locator("body")).to_have_attribute("data-theme", "light")
    expect(page.locator(".enquiry-link")).to_have_count(3)
    no_overflow()

    # Sign-out clears customer and private note state, including browser history.
    page.goto(enquiry_url)
    expect(page.get_by_label("Private studio note")).to_be_visible()
    page.get_by_role("button", name="Sign out", exact=True).click()
    expect(page).to_have_url(BASE + "/studio")
    assert not page.get_by_text(reference, exact=True).count()
    assert not page.get_by_label("Private studio note").count()
    page.go_back()
    expect(page).to_have_url(BASE + "/studio")
    assert context.request.get(BASE + "/api/studio/enquiries").status == 401

    # Every access change clears private UI; supplied role headers cannot bypass it.
    for kind in ["expired", "disabled", "role", "revoked", "reset"]:
        db.staff_login_limits.delete_many({})
        sign_in()
        with page.expect_response(
            lambda response: (
                response.request.method == "GET"
                and response.url.endswith("/api" + enquiry_url.replace(BASE, ""))
            )
        ) as restored_enquiry:
            page.goto(enquiry_url)
        assert restored_enquiry.value.status == 200
        expect(page.get_by_label("Private studio note")).to_be_visible()
        page.get_by_label("Private studio note").fill(
            "Unsaved secret cleared on denial"
        )
        authorised_session = context.request.get(BASE + "/api/auth/session")
        assert authorised_session.status == 200
        stale_csrf = authorised_session.json()["csrf_token"]
        before_denial = db.booking_requests.find_one({"_id": saved["_id"]})
        if kind == "expired":
            db.staff_sessions.update_many(
                {}, {"$set": {"expires_at": datetime.now(UTC) - timedelta(seconds=1)}}
            )
        elif kind == "disabled":
            db.staff_identities.update_one(
                {"_id": "browser-staff"}, {"$set": {"enabled": False}}
            )
        elif kind == "role":
            db.staff_identities.update_one(
                {"_id": "browser-staff"}, {"$set": {"role": "client"}}
            )
        elif kind == "revoked":
            db.staff_sessions.update_many(
                {}, {"$set": {"revoked_at": datetime.now(UTC)}}
            )
        else:
            db.staff_identities.update_one(
                {"_id": "browser-staff"}, {"$set": {"auth_version": "fixture-reset"}}
            )
        assert context.request.get(
            BASE + "/api/studio/enquiries", headers={"X-Role": "staff"}
        ).status in (401, 403)
        # Background access checks may clear the form before a click. Exercise
        # the real denied write with this browser's cookies and formerly valid
        # CSRF, without racing a control that is supposed to disappear.
        denied_save = context.request.patch(
            BASE + "/api/studio/enquiries/" + saved["_id"],
            headers={"Origin": BASE, "X-CSRF-Token": stale_csrf},
            data={
                "expected_revision": before_denial["studio_revision"],
                "studio_note": "Unsaved secret cleared on denial",
            },
        )
        assert denied_save.status in (401, 403)
        assert db.booking_requests.find_one({"_id": saved["_id"]}) == before_denial
        try:
            with page.expect_response(
                lambda response: (
                    response.url.endswith("/api/auth/session")
                    and response.request.method == "GET"
                )
            ) as denied_restore:
                page.reload()
            assert denied_restore.value.status in (401, 403)
            expect(page).to_have_url(BASE + "/studio", timeout=15_000)
        except Exception:
            print(
                json.dumps(
                    {
                        "invalidation": kind,
                        "url": page.url,
                        "page_closed": page.is_closed(),
                        "browser_connected": browser.is_connected(),
                        "recent_api": network,
                    }
                ),
                file=sys.stderr,
            )
            raise
        # Redirecting to /studio starts another session-restoration request.
        # Keep the identity denied until that request has rendered sign-in;
        # restoring enabled/role earlier can authenticate the old cookie and
        # redirect home before the next iteration clears it.
        expect(page.get_by_label("Staff email")).to_be_visible()
        assert not page.get_by_label("Private studio note").count()
        db.staff_identities.update_one(
            {"_id": "browser-staff"}, {"$set": {"enabled": True, "role": "staff"}}
        )
        context.clear_cookies()
    stored = page.evaluate(
        "JSON.stringify({...localStorage}) + JSON.stringify({...sessionStorage})"
    )
    assert "Shared private note" not in stored and "inbox-customer" not in stored
    assert "csrf" not in stored and PASSWORD not in stored
    assert not errors, errors
    print(
        "studio inbox: real public reference → staff detail → triage → reload/new staff; "
        "conflict, archive/reopen, recovery, privacy, access changes, pagination, keyboard, "
        "themes, five widths; zero page errors/overflow"
    )
    browser.close()
