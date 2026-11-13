"""Private real browser document uploads, publication, versions and downloads."""

import os
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from auth import password_hash
from tests.test_studio_enquiries import record

BASE = os.getenv("ENTRY_TEST_URL", "http://127.0.0.1:5173")
PASSWORD = "documents-client-test-password"
EMAIL = "documents-client@example.test"
PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"
with MongoClient(os.environ["BROWSER_MONGODB_URI"]) as mongo, sync_playwright() as p:
    db = mongo["studio_suite_browser_test"]
    client_id, enquiry_id, grant_id = (str(uuid4()) for _ in range(3))
    db.staff_login_limits.delete_many({})
    db.client_login_limits.delete_many({})
    db.client_identities.delete_many({"email": EMAIL})
    db.client_identities.insert_one(
        {
            "_id": client_id,
            "email": EMAIL,
            "name": "Documents Client",
            "role": "client",
            "enabled": True,
            "auth_version": str(uuid4()),
            "password_hash": password_hash(PASSWORD),
        }
    )
    db.booking_requests.insert_one(
        record(_id=enquiry_id, email=EMAIL, studio_note="internal-secret-documents")
    )
    db.client_access.insert_one(
        {
            "_id": grant_id,
            "client_id": client_id,
            "enquiry_id": enquiry_id,
            "granted_at": datetime.now(UTC),
            "created_at": datetime.now(UTC),
            "revoked_at": None,
        }
    )
    browser = p.chromium.launch(headless=True)
    studio_context, client_context = (
        browser.new_context(accept_downloads=True),
        browser.new_context(accept_downloads=True),
    )
    studio, client = studio_context.new_page(), client_context.new_page()
    errors = []
    for page in (studio, client):
        page.on("pageerror", lambda error: errors.append(str(error)))
    studio.goto(BASE + "/studio")
    studio.get_by_label("Staff email").fill("staff@example.test")
    studio.get_by_label("Password", exact=True).fill("browser-test-password")
    studio.get_by_role("button", name="Sign in", exact=True).click()
    expect(studio).to_have_url(BASE + "/studio/home")
    with studio.expect_response(
        "**/api/studio/enquiries/*/client-access"
    ) as access_response:
        studio.goto(BASE + "/studio/enquiries/" + enquiry_id)
    assert access_response.value.status == 200, access_response.value.text()
    studio_docs = studio.get_by_role("region", name="Private enquiry documents")
    expect(studio_docs.get_by_label("Document title")).to_be_visible()
    client.goto(BASE + "/client")
    client.get_by_label("Client email").fill(EMAIL)
    client.get_by_label("Password", exact=True).fill(PASSWORD)
    client.get_by_role("button", name="Sign in", exact=True).click()
    expect(client).to_have_url(BASE + "/client/home")
    client.goto(BASE + "/client/enquiries/" + enquiry_id)
    client_docs = client.get_by_role("region", name="Private enquiry documents")
    expect(
        client_docs.get_by_text("No available document versions.", exact=True)
    ).to_be_visible()
    assert "internal-secret-documents" not in client.locator("body").inner_text()
    assert (
        client_docs.get_by_role(
            "button", name="Upload private document", exact=True
        ).count()
        == 0
    )

    def lost_upload_response(route):
        actual = route.fetch()
        assert actual.status == 200, actual.text()
        route.abort("failed")

    studio.route("**/documents/*/*/content", lost_upload_response, times=1)
    studio_docs.get_by_label("Document title").fill("Private session guide")
    studio_docs.get_by_label("Document file").set_input_files(
        {"name": "guide.pdf", "mimeType": "application/pdf", "buffer": PDF}
    )
    studio_docs.get_by_role(
        "button", name="Upload private document", exact=True
    ).click()
    expect(studio_docs.get_by_role("alert")).to_be_visible()
    studio_docs.get_by_role(
        "button", name="Retry same document upload", exact=True
    ).click()
    expect(studio_docs.get_by_role("status")).to_contain_text("Private document saved")
    expect(
        studio_docs.get_by_role(
            "heading", name="Private session guide · version 1", exact=True
        )
    ).to_be_visible()
    assert db.document_versions.count_documents({"grant_id": grant_id}) == 1
    client_docs.get_by_role("button", name="Refresh documents", exact=True).click()
    expect(
        client_docs.get_by_text("No available document versions.", exact=True)
    ).to_be_visible()
    studio_docs.get_by_role(
        "button", name="Publish Private session guide v1", exact=True
    ).click()
    expect(studio_docs.get_by_role("status")).to_contain_text(
        "available to the granted client"
    )
    client_docs.get_by_role("button", name="Refresh documents", exact=True).click()
    expect(
        client_docs.get_by_role(
            "heading", name="Private session guide · version 1", exact=True
        )
    ).to_be_visible()
    with client.expect_download() as delivery:
        client_docs.get_by_role(
            "button", name="Download guide.pdf v1", exact=True
        ).click()
    with tempfile.TemporaryDirectory() as temporary:
        destination = Path(temporary) / "guide.pdf"
        delivery.value.save_as(destination)
        assert destination.read_bytes() == PDF
    client.reload()
    expect(
        client_docs.get_by_role(
            "heading", name="Private session guide · version 1", exact=True
        )
    ).to_be_visible()
    first = db.document_versions.find_one({"grant_id": grant_id})
    studio_docs.get_by_label("Document version target").select_option(
        first["document_id"]
    )
    studio_docs.get_by_label("Document title").fill("Private session guide")
    studio_docs.get_by_label("Document file").set_input_files(
        {"name": "guide-v2.pdf", "mimeType": "application/pdf", "buffer": PDF}
    )
    studio_docs.get_by_role(
        "button", name="Upload private document", exact=True
    ).click()
    expect(
        studio_docs.get_by_role(
            "heading", name="Private session guide · version 2", exact=True
        )
    ).to_be_visible()
    client_docs.get_by_role("button", name="Refresh documents", exact=True).click()
    expect(
        client_docs.get_by_role(
            "heading", name="Private session guide · version 2", exact=True
        )
    ).not_to_be_visible()
    assert db.document_versions.count_documents({"grant_id": grant_id}) == 2
    studio_docs.get_by_role(
        "button", name="Unpublish Private session guide v1", exact=True
    ).click()
    expect(studio_docs.get_by_role("status")).to_contain_text("private to the studio")
    client_docs.get_by_role("button", name="Refresh documents", exact=True).click()
    expect(
        client_docs.get_by_text("No available document versions.", exact=True)
    ).to_be_visible()
    assert (
        client_context.request.get(
            BASE
            + f"/api/client/enquiries/{enquiry_id}/documents/{first['_id']}/download"
        ).status
        == 404
    )
    for width in (320, 768, 1440):
        for page in (studio, client):
            page.set_viewport_size({"width": width, "height": 900})
            assert not page.evaluate(
                "document.documentElement.scrollWidth > innerWidth"
            )
    db.client_access.update_one(
        {"_id": grant_id}, {"$set": {"revoked_at": datetime.now(UTC)}}
    )
    client_docs.get_by_role("button", name="Refresh documents", exact=True).click()
    expect(client_docs.get_by_role("alert")).to_contain_text("unavailable")
    assert (
        db.booking_requests.find_one({"_id": enquiry_id})["state"]
        == "awaiting_studio_confirmation"
    )
    assert not errors, errors
    browser.close()
print(
    "Document browser regression passed: private real upload/download, uncertain-response retry, explicit publication, persistent versions, unpublish, mobile widths and grant withdrawal."
)
