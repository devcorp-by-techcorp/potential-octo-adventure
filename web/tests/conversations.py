"""Real browser/API/MongoDB conversation delivery, retries and withdrawal."""

import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from auth import password_hash
from tests.test_studio_enquiries import record

BASE = os.getenv("ENTRY_TEST_URL", "http://127.0.0.1:5173")
PASSWORD = "conversation-client-test-password"
EMAIL = "conversation-client@example.test"
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
            "name": "Conversation Client",
            "role": "client",
            "enabled": True,
            "auth_version": str(uuid4()),
            "password_hash": password_hash(PASSWORD),
        }
    )
    db.booking_requests.insert_one(
        record(_id=enquiry_id, email=EMAIL, studio_note="internal-secret-conversation")
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
    studio_context, client_context = browser.new_context(), browser.new_context()
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
        lambda response: response.url.endswith(
            "/api/studio/enquiries/" + enquiry_id + "/client-access"
        )
    ) as access_response, studio.expect_response(
        lambda response: response.url.endswith(
            "/api/studio/enquiries/" + enquiry_id + "/conversations/" + client_id
        )
    ) as conversation_response:
        studio.goto(BASE + "/studio/enquiries/" + enquiry_id)
    assert access_response.value.status == 200, access_response.value.text()
    assert conversation_response.value.status == 200, conversation_response.value.text()
    expect(
        studio.get_by_role("region", name="Client and studio conversation")
        .get_by_label("Conversation client")
    ).to_contain_text("Conversation Client")
    studio_conversation = studio.get_by_role(
        "region", name="Client and studio conversation"
    )
    expect(studio_conversation.get_by_label("Conversation message")).to_be_visible()
    client.goto(BASE + "/client")
    client.get_by_label("Client email").fill(EMAIL)
    client.get_by_label("Password", exact=True).fill(PASSWORD)
    client.get_by_role("button", name="Sign in", exact=True).click()
    expect(client).to_have_url(BASE + "/client/home")
    client.goto(BASE + "/client/enquiries/" + enquiry_id)
    conversation = client.get_by_role("region", name="Client and studio conversation")
    expect(conversation.get_by_label("Conversation message")).to_be_visible()
    assert "internal-secret-conversation" not in client.locator("body").inner_text()
    conversation.get_by_label("Conversation message").fill(
        "Client browser message <script>text</script>"
    )
    conversation.get_by_role("button", name="Send message", exact=True).click()
    expect(
        conversation.get_by_text(
            "Client browser message <script>text</script>", exact=True
        )
    ).to_be_visible()
    studio_conversation.get_by_role(
        "button", name="Refresh conversation", exact=True
    ).click()
    expect(
        studio_conversation.get_by_text(
            "Client browser message <script>text</script>", exact=True
        )
    ).to_be_visible()
    expect(studio_conversation.get_by_role("status")).to_contain_text("1 unread")
    studio_conversation.get_by_role(
        "button", name="Mark displayed messages read", exact=True
    ).click()
    expect(studio_conversation.get_by_role("status")).to_contain_text("0 unread")
    studio_conversation.get_by_label("Conversation message").fill(
        "Studio browser reply"
    )
    studio_conversation.get_by_role("button", name="Send message", exact=True).click()
    expect(
        studio_conversation.get_by_text("Studio browser reply", exact=True)
    ).to_be_visible()
    client.reload()
    expect(conversation.get_by_text("Studio browser reply", exact=True)).to_be_visible()
    expect(conversation.get_by_role("status")).to_contain_text("1 unread")

    def uncertain(route):
        response = route.fetch()
        assert response.status == 200
        route.abort("failed")

    client.route("**/conversation/messages", uncertain, times=1)
    conversation.get_by_label("Conversation message").fill(
        "Lost response, committed once"
    )
    conversation.get_by_role("button", name="Send message", exact=True).click()
    expect(conversation.get_by_role("alert")).to_be_visible()
    conversation.get_by_role("button", name="Retry same message", exact=True).click()
    expect(
        conversation.get_by_text("Lost response, committed once", exact=True)
    ).to_be_visible()
    assert (
        db.conversation_messages.count_documents(
            {"text": "Lost response, committed once", "conversation_id": grant_id}
        )
        == 1
    )
    for width in (320, 768, 1440):
        client.set_viewport_size({"width": width, "height": 900})
        assert not client.evaluate("document.documentElement.scrollWidth > innerWidth")
    db.client_access.update_one(
        {"_id": grant_id}, {"$set": {"revoked_at": datetime.now(UTC)}}
    )
    conversation.get_by_role("button", name="Refresh conversation", exact=True).click()
    expect(conversation.get_by_role("alert")).to_contain_text("unavailable")
    expect(
        conversation.get_by_text("Studio browser reply", exact=True)
    ).not_to_be_visible()
    assert (
        db.booking_requests.find_one({"_id": enquiry_id})["state"]
        == "awaiting_studio_confirmation"
    )
    assert not errors, errors
    browser.close()
print(
    "Conversation browser regression passed: persistent two-session messages, unread/read, exact retry, private fields, mobile widths and grant withdrawal."
)
