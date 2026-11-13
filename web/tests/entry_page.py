"""Browser regression suite; run against the local browser_server.py fixture."""

import json
import os
import tempfile
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

base_url = os.getenv("ENTRY_TEST_URL", "http://127.0.0.1:5173")
artifacts = Path(os.getenv("ENTRY_TEST_ARTIFACTS", tempfile.gettempdir()))
artifacts.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path="/usr/bin/chromium"
        if Path("/usr/bin/chromium").exists()
        else None,
        headless=True,
    )
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base_url, wait_until="networkidle")
    page.screenshot(path=str(artifacts / "studio-hero.png"))
    page.get_by_role("button", name="Chat with Luma, AI booking assistant").click()
    page.get_by_label("Your message to Luma").fill(
        "I am Alex and would like Signature on 20 December 2099."
    )
    page.get_by_role("button", name="Send message", exact=True).click()
    expect(page.get_by_role("log")).to_contain_text(
        "review your Signature enquiry", timeout=10000
    )
    page.get_by_role("button", name="Review and send an enquiry").click()
    expect(page.get_by_role("dialog")).to_be_visible()
    assert page.locator("[name=name]").input_value() == "Alex Example"
    assert page.locator("[name=email]").input_value() == "alex@example.com"
    assert page.locator("[name=preferred_date]").input_value() == "2099-12-20"
    page.get_by_role("button", name="Send enquiry", exact=True).click()
    assert page.locator("input[type=checkbox]").evaluate("(i)=>!i.validity.valid")
    page.get_by_role("checkbox").check()
    page.get_by_role("button", name="Send enquiry", exact=True).click()
    expect(page.get_by_role("dialog")).to_contain_text(
        "pending confirmation", timeout=10000
    )
    expect(page.get_by_role("dialog")).to_contain_text("Reference: IS-")
    page.screenshot(path=str(artifacts / "studio-receipt.png"))
    page.get_by_role("button", name="Back to the studio", exact=True).click()
    page.get_by_role("button", name="Chat with Luma, AI booking assistant").click()
    page.get_by_label("Your message to Luma").fill("Is my booking confirmed?")
    page.get_by_role("button", name="Send message", exact=True).click()
    expect(page.get_by_role("log")).to_contain_text(
        "tentative enquiry is with the studio", timeout=10000
    )
    page.get_by_role("button", name="Close Luma chat").click()
    page.get_by_role("button", name="View A place at the table", exact=True).click()
    page.keyboard.press("ArrowRight")
    expect(page.get_by_role("dialog")).to_contain_text("In your own light")
    page.keyboard.press("Escape")
    assert page.get_by_role(
        "button", name="View A place at the table", exact=True
    ).evaluate("(e)=>e===document.activeElement")
    for width in [320, 390, 768, 1024, 1440]:
        page.set_viewport_size({"width": width, "height": 844})
        assert not page.evaluate("document.documentElement.scrollWidth>innerWidth"), (
            width
        )
    page.set_viewport_size({"width": 390, "height": 844})
    page.evaluate("scrollTo(0,0)")
    page.screenshot(path=str(artifacts / "studio-mobile-hero.png"))
    page.get_by_role("button", name="Open menu", exact=True).click()
    expect(page.get_by_role("navigation", name="Main navigation")).to_be_visible()
    page.get_by_role("link", name="Experience", exact=True).click()
    expect(page.get_by_role("button", name="Open menu", exact=True)).to_have_attribute(
        "aria-expanded", "false"
    )
    assert not page.get_by_role("button", name="Switch to dark theme").count()
    page.evaluate('localStorage.setItem("illuminate-theme", "dark")')
    page.reload(wait_until="networkidle")
    expect(page.locator("body")).to_have_attribute("data-theme", "light")
    page.get_by_role("link", name="Studio access").click()
    expect(page.get_by_role("heading", name="Studio sign-in")).to_be_visible()
    expect(page.get_by_label("Staff email")).to_be_visible()
    page.goto(base_url + "/client")
    expect(page.get_by_role("heading", name="Client sign-in")).to_be_visible()
    expect(page.get_by_label("Client email")).to_be_visible()
    assert page.request.get(base_url + "/api/client/enquiries").status == 401
    page.goto(base_url + "/no-such-page")
    expect(page.get_by_role("heading", name="Page not found")).to_be_visible()
    print(
        json.dumps(
            {
                "flow": "Luma -> prefilled form -> consent -> stored enquiry -> pending-state chat",
                "responsive_widths": [320, 390, 768, 1024, 1440],
                "errors": errors,
            }
        )
    )
    assert not errors
    # Service failure and recoverable input on the public form.
    page.goto(base_url)
    page.route(
        "**/api/bookings",
        lambda route: route.fulfill(
            status=503, json={"detail": "The studio is temporarily unavailable."}
        ),
    )
    page.get_by_role("button", name="Enquire about Essentials", exact=True).click()
    page.locator("[name=name]").fill("Retry Example")
    page.locator("[name=email]").fill("retry@example.com")
    page.locator("[name=preferred_date]").fill("2099-12-20")
    page.get_by_role("checkbox").check()
    page.get_by_role("button", name="Send enquiry", exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
    assert page.locator("[name=name]").input_value() == "Retry Example"
    assert not page.get_by_role("heading", name="Your enquiry is received").count()
    print("error path: input preserved; no false receipt")

    # Failed Luma delivery must be obvious, recoverable and never appear sent.
    page.goto(base_url)
    page.route(
        "**/api/luma/chat",
        lambda route: route.fulfill(
            status=503,
            json={"detail": "Luma is unavailable right now. You can still use the enquiry form."},
        ),
    )
    page.get_by_role("button", name="Chat with Luma, AI booking assistant").click()
    page.get_by_label("Your message to Luma").fill("I need a family session.")
    page.get_by_role("button", name="Send message", exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("Luma is unavailable")
    expect(page.get_by_label("Your message to Luma")).to_have_value(
        "I need a family session."
    )
    assert page.locator(".chat-message.user").count() == 0
    page.unroute("**/api/luma/chat")
    page.get_by_role("button", name="Send message", exact=True).click()
    expect(page.locator(".chat-message.user")).to_contain_text(
        "I need a family session.", timeout=10000
    )
    expect(page.get_by_role("log")).to_contain_text(
        "review your Signature enquiry", timeout=10000
    )
    print("Luma error path: failed message restored; successful retry delivered")
    browser.close()
