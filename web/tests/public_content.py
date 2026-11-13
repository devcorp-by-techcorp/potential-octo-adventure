"""Real API/MongoDB browser verification of narrative draft and publication."""

import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from pymongo import MongoClient

BASE = os.getenv("ENTRY_TEST_URL", "http://127.0.0.1:5173")

with MongoClient(os.environ["BROWSER_MONGODB_URI"]) as mongo, sync_playwright() as p:
    db = mongo["studio_suite_browser_test"]
    for name in (
        "public_content",
        "public_content_history",
        "public_content_commands",
        "staff_login_limits",
    ):
        db[name].delete_many({})
    browser = p.chromium.launch(
        executable_path="/usr/bin/chromium"
        if Path("/usr/bin/chromium").exists()
        else None,
        headless=True,
    )
    staff_context = browser.new_context()
    staff = staff_context.new_page()
    public_context = browser.new_context()
    page = public_context.new_page()
    errors = []
    for target in (staff, page):
        target.on("pageerror", lambda error: errors.append(str(error)))
    original = public_context.request.get(BASE + "/api/public/content").json()
    assert public_context.request.get(BASE + "/api/studio/content").status == 401
    assert (
        public_context.request.get(BASE + "/api/studio/content/history").status == 401
    )
    staff.goto(BASE + "/studio/content")
    expect(staff).to_have_url(BASE + "/studio")
    staff.get_by_label("Staff email").fill("staff@example.test")
    staff.get_by_label("Password", exact=True).fill("browser-test-password")
    staff.get_by_role("button", name="Sign in", exact=True).click()
    expect(staff).to_have_url(BASE + "/studio/home")
    with staff.expect_response(
        lambda response: response.url.endswith("/api/studio/content")
    ) as content_response:
        staff.goto(BASE + "/studio/content")
    assert content_response.value.status == 200, content_response.value.text()
    expect(
        staff.get_by_role("heading", name="Website narrative", exact=True)
    ).to_be_visible()
    changed = "<b>Browser narrative test: photographs and stories.</b>"
    hero_description = staff.locator("label").filter(has_text="Hero description").locator("textarea")
    hero_description.fill(changed)
    expect(
        staff.get_by_role("button", name="Publish saved draft", exact=True)
    ).to_be_disabled()
    staff.get_by_role("button", name="Save draft", exact=True).click()
    expect(staff.get_by_role("status")).to_have_text(
        "Draft saved. Public content unchanged."
    )
    assert public_context.request.get(BASE + "/api/public/content").json() == original
    staff.reload()
    expect(hero_description).to_have_value(changed)
    staff.get_by_role("button", name="Publish saved draft", exact=True).click()
    expect(staff.get_by_role("status")).to_have_text("Saved draft published.")
    page.goto(BASE)
    expect(page.locator(".hero-description")).to_have_text(changed)
    assert page.locator(".hero-description b").count() == 0
    page.reload()
    expect(page.locator(".hero-description")).to_have_text(changed)
    assert (
        "actor_id"
        not in public_context.request.get(BASE + "/api/public/content").text()
    )
    staff.get_by_role(
        "button", name="Restore original source to draft", exact=True
    ).click()
    expect(staff.get_by_role("status")).to_contain_text("Version restored to draft")
    assert (
        public_context.request.get(BASE + "/api/public/content").json()["content"][
            "hero_description"
        ]
        == changed
    )
    staff.get_by_role("button", name="Publish saved draft", exact=True).click()
    expect(staff.get_by_role("status")).to_have_text("Saved draft published.")
    page.reload()
    expect(page.locator(".hero-description")).to_have_text(
        original["content"]["hero_description"]
    )
    assert db.public_content_history.count_documents({}) == 4
    assert not errors, errors
    print(
        "public content: authenticated save, public isolation, reload persistence, separate publication, literal markup, restore without publication, history; zero page errors"
    )
    browser.close()
