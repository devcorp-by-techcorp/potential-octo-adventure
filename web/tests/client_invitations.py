"""Phase 3: real public → staff invitation → client enrollment/login/read-only access."""

import os
import re
import sys
import tempfile
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import TimeoutError as BrowserTimeoutError
from playwright.sync_api import expect, sync_playwright
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend/tests"))
from client_browser_fixtures import (
    ClientBrowserFixture,
    lose_acceptance_response,
    service_failure,
)

BASE = os.getenv("ENTRY_TEST_URL", "http://127.0.0.1:5173")
PASSWORD = "browser-client-password"
EMAIL = "invited-client@example.test"
WIDTHS = [320, 390, 768, 1024, 1440]

with MongoClient(os.environ["BROWSER_MONGODB_URI"]) as mongo, sync_playwright() as p:
    db = mongo["studio_suite_browser_test"]
    fixture = ClientBrowserFixture(db)
    browser = p.chromium.launch(headless=True)
    errors, consoles, urls, secrets = [], [], [], []

    def new_view(context=None):
        context = context or browser.new_context(
            viewport={"width": 1440, "height": 900}
        )
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: consoles.append(message.text))
        page.on("request", lambda request: urls.append(request.url))
        return context, page

    staff_context, staff = new_view()
    context, page = new_view()

    def no_overflow(target):
        for width in WIDTHS:
            target.set_viewport_size({"width": width, "height": 844})
            assert not target.evaluate(
                "document.documentElement.scrollWidth > innerWidth"
            ), width

    def submit_public(email=EMAIL, name="Invited Public Client"):
        staff.goto(BASE)
        staff.get_by_role("button", name="Enquire about Essentials", exact=True).click()
        staff.locator("[name=name]").fill(name)
        staff.locator("[name=email]").fill(email)
        staff.locator("[name=preferred_date]").fill("2099-12-20")
        staff.locator("[name=message]").fill("Original client message <b>text only</b>")
        staff.get_by_role("checkbox").check()
        with staff.expect_response("**/api/bookings") as submission:
            staff.get_by_role("button", name="Send enquiry", exact=True).click()
        assert submission.value.status == 201, submission.value.text()
        expect(staff.get_by_role("dialog")).to_contain_text(
            "Reference: IS-", timeout=15_000
        )
        reference = re.search(
            r"IS-[A-F0-9]{12}", staff.get_by_role("dialog").inner_text()
        ).group()
        return fixture.enquiry(reference)

    def open_staff(enquiry):
        path = "/api/studio/enquiries/" + enquiry["_id"]
        with staff.expect_response(
            lambda response: response.request.method == "GET"
            and response.url.endswith(path)
        ) as response:
            staff.goto(BASE + "/studio/enquiries/" + enquiry["_id"])
        assert response.value.status == 200, response.value.text()
        expect(
            staff.get_by_role("heading", name=enquiry["reference"], exact=True)
        ).to_be_visible()
        expect(
            staff.get_by_role("button", name="Issue invitation", exact=True)
        ).to_be_enabled(timeout=15_000)

    def refresh_invitation_status():
        # A mutation already reloads the list. Wait for that read to render
        # before refreshing, so the expected response cannot be an older read
        # that this click aborts after its headers arrive.
        expect(
            staff.get_by_role("button", name="Issue invitation", exact=True)
        ).to_be_enabled()
        with staff.expect_response(
            lambda response: response.request.method == "GET"
            and response.url.endswith("client-invitations")
        ) as refreshed_status:
            staff.get_by_role(
                "button", name="Refresh invitation status", exact=True
            ).click()
        assert refreshed_status.value.status == 200, refreshed_status.value.text()
        return refreshed_status.value.json()

    def issue_link():
        with staff.expect_response(
            lambda response: response.request.method == "POST"
            and response.url.endswith("/client-invitations")
        ) as result:
            staff.get_by_role("button", name="Issue invitation", exact=True).click()
        assert result.value.status == 200, result.value.text()
        expect(staff.get_by_label("Invitation link (shown once)")).to_be_visible()
        expect(staff.get_by_label("Invitation link (shown once)")).to_be_focused()
        link = staff.get_by_label("Invitation link (shown once)").input_value()
        secrets.append(link.split("#")[1])
        assert "?" not in link and len(secrets[-1]) == 43
        # Issuing triggers its own list refresh. Starting another one here can
        # abort the automatic response and lose its body in Chromium's protocol.
        expect(
            staff.get_by_role("button", name="Issue invitation", exact=True)
        ).to_be_enabled()
        current_enquiry = re.search(r"/studio/enquiries/([^/?]+)", staff.url).group(1)
        assert db.client_invitations.count_documents(
            {"enquiry_id": current_enquiry, "status": "pending"}
        ) == 1
        expect(staff.get_by_text(re.compile("Invitation pending"))).to_be_visible(
            timeout=15_000
        )
        return link

    def open_invitation(target, link):
        with target.expect_response(
            "**/api/auth/client/invitations/inspect"
        ) as inspection:
            target.goto(link)
        assert inspection.value.status == 200, inspection.value.text()

    def open_client_enquiry(target, url, expected_status=200):
        api_url = BASE + "/api" + url.removeprefix(BASE)
        with target.expect_response(
            lambda response: response.request.method == "GET" and response.url == api_url
        ) as detail_response:
            target.goto(url)
        assert detail_response.value.status == expected_status, detail_response.value.text()

    def client_sign_in(target=page, email=EMAIL, expected_status=200):
        expect(target.get_by_label("Client email")).to_be_visible(timeout=15_000)
        target.get_by_label("Client email").fill(email)
        target.get_by_label("Password", exact=True).fill(PASSWORD)
        with target.expect_response(
            lambda response: response.url.endswith("/api/auth/client/login")
        ) as login_response:
            target.get_by_role("button", name="Sign in", exact=True).click()
        assert login_response.value.status == expected_status, login_response.value.text()
        if expected_status == 200:
            expect(
                target.get_by_text("Signed in as " + email, exact=True)
            ).to_be_visible()

    def client_logout(target=page):
        try:
            with target.expect_response(
                lambda response: response.url.endswith("/api/auth/client/logout")
            ) as logout_response:
                target.get_by_role("button", name="Sign out", exact=True).click()
        except BrowserTimeoutError:
            print("Logout failure URL:", target.url, flush=True)
            print("Logout failure page:", target.locator("body").inner_text(), flush=True)
            raise
        assert logout_response.value.status == 204, logout_response.value.text()
        expect(target).to_have_url(BASE + "/client")
        expect(target.get_by_role("status")).to_contain_text("signed out")

    # Public submission and real staff sign-in, with independent client cookie jar.
    enquiry = submit_public()
    staff.goto(BASE + "/studio")
    staff.get_by_label("Staff email").fill("staff@example.test")
    staff.get_by_label("Password", exact=True).fill("browser-test-password")
    with staff.expect_response("**/api/auth/login") as staff_login:
        staff.get_by_role("button", name="Sign in", exact=True).click()
    assert staff_login.value.status == 200, staff_login.value.text()
    expect(staff).to_have_url(BASE + "/studio/home", timeout=15_000)
    open_staff(enquiry)
    fixture.private_fields(enquiry["_id"])
    link = issue_link()
    no_overflow(staff)
    # Trusted manual copying is available; no send/composition action exists.
    staff_context.grant_permissions(["clipboard-read", "clipboard-write"])
    staff.get_by_role("button", name="Copy invitation link").click()
    expect(
        staff.get_by_text(
            "Invitation link copied. Deliver through your trusted channel."
        )
    ).to_be_visible()
    assert staff.evaluate("navigator.clipboard.readText()") == link
    assert staff_context.request.get(BASE + "/api/auth/client/session").status == 401
    assert staff_context.request.get(BASE + "/api/client/enquiries").status == 401

    page.goto(BASE + "/client/home")
    expect(page).to_have_url(BASE + "/client")
    no_overflow(page)
    open_invitation(page, link)
    expect(page).to_have_url(BASE + "/client/accept")
    expect(page.get_by_label("Choose a password")).to_be_visible()
    assert page.evaluate("location.hash") == ""
    no_overflow(page)
    # Failed enrollment preserves the secret in memory, never reports success.
    page.route("**/api/auth/client/invitations/accept", service_failure)
    page.get_by_label("Choose a password").fill(PASSWORD)
    page.get_by_role("button", name="Accept invitation", exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    assert db.client_identities.count_documents({}) == 0
    expect(page.get_by_label("Original enrollment password")).to_be_focused()
    page.unroute("**/api/auth/client/invitations/accept")
    page.get_by_role("button", name="Check invitation status").click()
    expect(page.get_by_label("Choose a password")).to_be_visible()
    page.get_by_label("Choose a password").focus()
    page.keyboard.type(PASSWORD)
    page.keyboard.press("Tab")
    expect(
        page.get_by_role("button", name="Accept invitation", exact=True)
    ).to_be_focused()
    with page.expect_response(
        lambda response: response.url.endswith("/api/auth/client/invitations/accept")
    ) as first_acceptance:
        page.keyboard.press("Enter")
    assert first_acceptance.value.status == 200, first_acceptance.value.text()
    detail_url = BASE + "/client/enquiries/" + enquiry["_id"]
    expect(page).to_have_url(detail_url)
    expect(
        page.get_by_role("heading", name=enquiry["reference"], exact=True)
    ).to_be_focused()
    expect(page.get_by_text("20/12/2099", exact=True)).to_be_visible()
    expect(
        page.get_by_text("Original client message <b>text only</b>", exact=True)
    ).to_be_visible()
    assert not page.locator(".enquiry-details b").count()
    assert "UTC" in page.locator(".enquiry-details").inner_text()
    assert "client-must-never-see" not in page.locator("body").inner_text()
    assert not page.get_by_label("Private studio note").count()
    assert not page.get_by_role("button", name="Save changes").count()
    no_overflow(page)
    for theme in ["dark", "light"]:
        page.evaluate("theme => localStorage.setItem('illuminate-theme', theme)", theme)
        page.reload()
        expect(
            page.get_by_role("heading", name=enquiry["reference"], exact=True)
        ).to_be_visible()
        expect(page.locator("body")).to_have_attribute("data-theme", "light")
        no_overflow(page)
    page.screenshot(path=str(Path(tempfile.gettempdir()) / "client-enquiry-mobile.png"))
    assert context.request.get(BASE + "/api/studio/enquiries").status == 401
    assert (
        context.request.patch(
            BASE + "/api/studio/enquiries/" + enquiry["_id"],
            data={"expected_revision": 0, "studio_note": "attack"},
        ).status
        == 401
    )
    assert (
        context.request.post(
            BASE + "/api/studio/enquiries/" + enquiry["_id"] + "/client-invitations",
            data={},
        ).status
        == 401
    )
    assert context.request.get(BASE + "/api/auth/session").status == 401
    page.goto(BASE + "/studio/enquiries/" + enquiry["_id"])
    expect(page).to_have_url(BASE + "/studio")
    assert not page.get_by_text(enquiry["reference"], exact=True).count()
    open_client_enquiry(page, detail_url)
    expect(
        page.get_by_role("heading", name=enquiry["reference"], exact=True)
    ).to_be_visible()

    # Sign out, failure/error focus and real sign-in; another authenticated view.
    client_logout()
    assert enquiry["reference"] not in page.locator("body").inner_text()
    assert context.request.get(BASE + "/api/client/enquiries").status == 401
    page.goto(detail_url)
    expect(page).to_have_url(BASE + "/client")
    fixture.reset_limits()
    page.get_by_label("Client email").fill(EMAIL)
    page.get_by_label("Password", exact=True).fill("incorrect-password")
    page.get_by_role("button", name="Sign in", exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("Email or password is incorrect")
    expect(page.get_by_label("Client email")).to_be_focused()
    assert page.get_by_label("Password", exact=True).input_value() == ""
    page.route("**/api/auth/client/login", service_failure)
    client_sign_in(expected_status=503)
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    expect(page.get_by_label("Client email")).to_be_focused()
    assert page.get_by_label("Password", exact=True).input_value() == ""
    page.unroute("**/api/auth/client/login")
    client_sign_in()
    expect(page).to_have_url(BASE + "/client/home")
    page.get_by_role("link", name=re.compile(enquiry["reference"])).click()
    expect(page).to_have_url(detail_url)
    another_context, another = new_view()
    another.goto(BASE + "/client")
    client_sign_in(another)
    expect(another).to_have_url(BASE + "/client/home")
    another.get_by_role("link", name=re.compile(enquiry["reference"])).click()
    expect(
        another.get_by_role("heading", name=enquiry["reference"], exact=True)
    ).to_be_visible()

    # Reset fixture budgets between independent scenarios; production limits stay intact.
    fixture.reset_limits()
    # A second invitation requires matching existing-client auth; hashes are unchanged.
    before_hash = db.client_identities.find_one({"email": EMAIL})["password_hash"]
    second_enquiry = submit_public()
    open_staff(second_enquiry)
    second_link = issue_link()
    client_logout()
    open_invitation(page, second_link)
    expect(page.get_by_label("Client email")).to_have_value(EMAIL)
    assert not page.get_by_label("Choose a password").count()
    client_sign_in()
    expect(page).to_have_url(BASE + "/client/accept")
    expect(
        page.get_by_role("button", name="Accept invitation", exact=True)
    ).to_be_focused()
    page.keyboard.press("Enter")
    expect(page).to_have_url(BASE + "/client/enquiries/" + second_enquiry["_id"])
    assert (
        db.client_identities.find_one({"email": EMAIL})["password_hash"] == before_hash
    )
    assert db.client_identities.count_documents({"email": EMAIL}) == 1
    assert db.client_access.count_documents({}) == 2

    fixture.reset_limits()
    # Second client cannot read first client's enquiry, even with a supplied ID/role.
    other_enquiry = submit_public("other-client@example.test", "Other Public Client")
    open_staff(other_enquiry)
    other_link = issue_link()
    other_context, other = new_view()
    open_invitation(other, other_link)
    expect(other.get_by_label("Choose a password")).to_be_visible()
    other.get_by_label("Choose a password").fill(PASSWORD)
    other.get_by_role("button", name="Accept invitation", exact=True).click()
    expect(other).to_have_url(BASE + "/client/enquiries/" + other_enquiry["_id"])
    assert (
        other_context.request.get(
            BASE + "/api/client/enquiries/" + enquiry["_id"],
            headers={
                "X-Role": "staff",
                "X-Client-Id": db.client_identities.find_one({"email": EMAIL})["_id"],
            },
        ).status
        == 404
    )
    open_client_enquiry(other, detail_url, expected_status=404)
    expect(other.get_by_role("alert")).to_contain_text("not found or unavailable")
    assert enquiry["reference"] not in other.locator("body").inner_text()
    assert other_context.request.get(BASE + "/api/studio/enquiries").status == 401
    # Existing invitation cannot be accepted by the wrong authenticated identity.
    open_staff(enquiry)
    wrong_account_link = issue_link()
    open_invitation(other, wrong_account_link)
    expect(other.get_by_role("alert")).to_contain_text(
        "Sign out and use the invited client"
    )
    assert not other.get_by_role("button", name="Accept invitation", exact=True).count()
    same_account = db.client_identities.find_one({"email": EMAIL})
    other_session = other_context.request.get(BASE + "/api/auth/client/session").json()
    wrong = other_context.request.post(
        BASE + "/api/auth/client/invitations/accept",
        headers={"Origin": BASE, "X-CSRF-Token": other_session["csrf_token"]},
        data={"token": wrong_account_link.split("#")[1]},
    )
    assert wrong.status == 409, wrong.text
    assert (
        db.client_identities.find_one({"email": EMAIL})["password_hash"]
        == same_account["password_hash"]
    )

    # Replacement, revocation, expiry and invalid/used invitation UI.
    replaced_link = wrong_account_link
    replacement = issue_link()
    invalid_context, invalid = new_view()
    open_invitation(invalid, replaced_link)
    expect(invalid.get_by_role("status")).to_contain_text("revoked")
    assert not invalid.get_by_role(
        "button", name="Accept invitation", exact=True
    ).count()
    staff.get_by_role("button", name="Revoke pending invitation").click()
    expect(staff.get_by_text("Pending invitation revoked.")).to_be_visible()
    open_invitation(invalid, replacement)
    expect(invalid.get_by_role("status")).to_contain_text("revoked")
    expired_link = issue_link()
    latest = db.client_invitations.find_one(
        {
            "token_hash": __import__("hashlib")
            .sha256(expired_link.split("#")[1].encode())
            .hexdigest()
        }
    )
    fixture.expire_invitation(latest["_id"])
    expired_status = refresh_invitation_status()
    assert any(
        item["id"] == latest["_id"] and item["status"] == "expired"
        for item in expired_status["items"]
    )
    expect(staff.get_by_text(re.compile("Invitation expired"))).to_be_visible()
    open_invitation(invalid, expired_link)
    expect(invalid.get_by_role("status")).to_contain_text("expired")
    invalid.goto(BASE + "/client/accept#" + "x" * 43)
    expect(invalid.get_by_role("alert")).to_contain_text("invalid")
    open_invitation(invalid, link)
    expect(invalid.get_by_role("status")).to_contain_text("accepted")
    invalid.reload()
    expect(invalid.get_by_role("alert")).to_contain_text(
        "secret is missing", timeout=15_000
    )
    invalid.goto(BASE + "/client/enquiries/" + str(uuid4()))
    expect(invalid).to_have_url(BASE + "/client")

    # A committed acceptance with a lost response is recovered, never enrolled twice.
    lost_enquiry = submit_public("lost-client@example.test", "Lost Response Client")
    open_staff(lost_enquiry)
    lost_link = issue_link()
    lost_context, lost = new_view()
    open_invitation(lost, lost_link)
    expect(lost.get_by_label("Choose a password")).to_be_visible()
    lost.route(
        "**/api/auth/client/invitations/accept",
        lambda route: lose_acceptance_response(route, lost_context),
    )
    lost.get_by_label("Choose a password").fill(PASSWORD)
    lost.get_by_role("button", name="Accept invitation", exact=True).click()
    expect(lost.get_by_role("alert")).to_contain_text(
        "temporarily unavailable", timeout=30_000
    )
    assert (
        db.client_identities.count_documents({"email": "lost-client@example.test"}) == 1
    )
    count_before = db.client_access.count_documents({})
    lost.unroute("**/api/auth/client/invitations/accept")
    lost.get_by_label("Original enrollment password").fill(PASSWORD)
    lost.get_by_role("button", name="Recover completed acceptance").click()
    expect(lost).to_have_url(BASE + "/client/enquiries/" + lost_enquiry["_id"])
    assert (
        db.client_identities.count_documents({"email": "lost-client@example.test"}) == 1
    )
    assert db.client_access.count_documents({}) == count_before

    # A lost response can still install the real session cookie. Restore its
    # memory-only CSRF before recovery instead of repeatedly submitting without it.
    cookie_enquiry = fixture.client_enquiry(
        enquiry, "cookie-client@example.test", "Cookie Response Client"
    )
    open_staff(cookie_enquiry)
    cookie_link = issue_link()
    cookie_context, cookie_page = new_view()
    open_invitation(cookie_page, cookie_link)
    expect(cookie_page.get_by_label("Choose a password")).to_be_visible()
    cookie_page.route(
        "**/api/auth/client/invitations/accept",
        lambda route: lose_acceptance_response(route, cookie_context, keep_cookie=True),
    )
    cookie_page.get_by_label("Choose a password").fill(PASSWORD)
    cookie_page.get_by_role("button", name="Accept invitation", exact=True).click()
    expect(
        cookie_page.get_by_text("Signed in as cookie-client@example.test")
    ).to_be_visible()
    assert cookie_context.request.get(BASE + "/api/auth/client/session").status == 200
    assert not cookie_page.locator(".enquiry-details").count()
    count_before = db.client_access.count_documents({})
    cookie_page.unroute("**/api/auth/client/invitations/accept")
    cookie_page.get_by_role("button", name="Recover completed acceptance").click()
    expect(cookie_page).to_have_url(BASE + "/client/enquiries/" + cookie_enquiry["_id"])
    assert db.client_access.count_documents({}) == count_before
    assert (
        db.client_identities.count_documents({"email": "cookie-client@example.test"})
        == 1
    )

    # Access/service errors clear data until successful real recovery.
    page.route("**/api/client/enquiries/*", service_failure)
    open_client_enquiry(page, detail_url, expected_status=503)
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    assert not page.locator(".enquiry-details").count()
    page.unroute("**/api/client/enquiries/*")
    page.get_by_role("button", name="Try again", exact=True).click()
    expect(
        page.get_by_role("heading", name=enquiry["reference"], exact=True)
    ).to_be_visible()
    page.route("**/api/auth/client/session", service_failure)
    page.reload()
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    assert not page.locator(".enquiry-details").count()
    page.unroute("**/api/auth/client/session")
    page.get_by_role("button", name="Try again", exact=True).click()
    expect(
        page.get_by_role("heading", name=enquiry["reference"], exact=True)
    ).to_be_visible()
    open_client_enquiry(page, BASE + "/client/enquiries/" + str(uuid4()), expected_status=404)
    expect(page.get_by_role("alert")).to_contain_text("not found or unavailable")
    assert not page.locator(".enquiry-details").count()

    # A real successful private response arriving after sign-out cannot restore data.
    page.route("**/api/client/enquiries/" + enquiry["_id"], fixture.delay_private_read)
    page.goto(detail_url)
    expect(page.get_by_role("button", name="Sign out", exact=True)).to_be_visible()
    fixture.wait_for_delayed_read(page)
    client_logout()
    fixture.release_private_reads()
    page.unroute("**/api/client/enquiries/" + enquiry["_id"])
    assert enquiry["reference"] not in page.locator("body").inner_text()
    assert not page.locator(".enquiry-details").count()

    # Current expiry/revocation/reset/disable deny and clear client content.
    for kind in ["expired", "revoked", "reset", "disabled"]:
        fixture.restore_client(EMAIL)
        context.clear_cookies(name="client_session")
        page.goto(BASE + "/client")
        client_sign_in()
        expect(page).to_have_url(BASE + "/client/home")
        open_client_enquiry(page, detail_url)
        expect(
            page.get_by_role("heading", name=enquiry["reference"], exact=True)
        ).to_be_visible()
        fixture.invalidate_client(EMAIL, kind)
        assert (
            context.request.get(BASE + "/api/client/enquiries/" + enquiry["_id"]).status
            == 401
        )
        page.reload()
        expect(page).to_have_url(BASE + "/client")
        expect(page.get_by_label("Client email")).to_be_visible()
        assert enquiry["reference"] not in page.locator("body").inner_text()
    fixture.restore_client(EMAIL)
    # Switching to the second identity in the same browser cannot retain first content.
    client_sign_in(email="other-client@example.test")
    expect(page).to_have_url(BASE + "/client/home")
    assert enquiry["reference"] not in page.locator("body").inner_text()
    expect(
        page.get_by_role("link", name=re.compile(other_enquiry["reference"]))
    ).to_be_visible()
    client_logout()
    no_overflow(page)

    # Staff withdrawal is persistent and visible through real authenticated endpoints.
    client_sign_in()
    expect(page).to_have_url(BASE + "/client/home")
    open_staff(enquiry)
    expect(
        staff.get_by_role("button", name="Revoke enquiry access", exact=True)
    ).to_be_visible()
    staff.get_by_role("button", name="Revoke enquiry access", exact=True).click()
    expect(staff.get_by_role("status").filter(has_text="Client access revoked")).to_be_visible()
    expect(staff.get_by_text(re.compile("Access revoked"), exact=False)).to_be_visible()
    open_client_enquiry(page, detail_url, expected_status=404)
    expect(page.get_by_role("alert")).to_contain_text("not found or unavailable")
    assert not page.locator(".enquiry-details").count()
    staff.reload()
    expect(staff).to_have_url(
        BASE + "/studio/enquiries/" + enquiry["_id"], timeout=15_000
    )
    assert db.client_access.find_one({"enquiry_id": enquiry["_id"]})["revoked_at"]
    expect(
        staff.get_by_text(re.compile("Access revoked"), exact=False)
    ).to_be_visible(timeout=30_000)
    assert not staff.get_by_role(
        "button", name="Revoke enquiry access", exact=True
    ).count()
    fresh_link = issue_link()
    open_invitation(page, fresh_link)
    page.get_by_role("button", name="Accept invitation", exact=True).click()
    expect(page).to_have_url(detail_url)
    expect(
        page.get_by_role("heading", name=enquiry["reference"], exact=True)
    ).to_be_visible()
    assert (
        db.client_access.count_documents(
            {"enquiry_id": enquiry["_id"], "client_id": same_account["_id"]}
        )
        == 1
    )
    staff.get_by_role("button", name="Refresh client access", exact=True).click()
    expect(
        staff.get_by_role("button", name="Revoke enquiry access", exact=True)
    ).to_be_visible()
    client_logout()

    # Browser URLs, console, storage and Mongo documents contain no bearer/password leaks.
    for target in [page, staff, other, another, invalid, lost, cookie_page]:
        storage = target.evaluate(
            "JSON.stringify({...localStorage}) + JSON.stringify({...sessionStorage})"
        )
        assert PASSWORD not in storage and "csrf_token" not in storage
        assert (
            enquiry["reference"] not in storage
            and "Original client message" not in storage
        )
        assert not any(secret in storage for secret in secrets)
        assert not any(
            cookie["value"] in storage
            for cookie in target.context.cookies()
            if cookie["name"] in {"client_session", "studio_session"}
        )
    for secret in secrets:
        assert not any(secret in url for url in urls)
        assert secret not in "\n".join(consoles)
        assert db.client_invitations.find_one(
            {"token_hash": __import__("hashlib").sha256(secret.encode()).hexdigest()}
        )
    assert PASSWORD not in "\n".join(consoles)
    assert not errors, errors
    assert (
        fixture.enquiry(enquiry["reference"])["state"] == "awaiting_studio_confirmation"
    )
    print(
        "client invitations: real public → staff issue/copy → client enrollment → sign-in → identical reference → reload/new view; existing credentials, isolation, fragment/storage privacy, lifecycle, atomic recovery, keyboard/themes/five widths; zero page errors/overflow"
    )
    browser.close()
