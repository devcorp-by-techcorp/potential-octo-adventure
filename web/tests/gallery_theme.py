"""C1-B lifecycle against the production bundle, with denied API fixtures.

No database, authentication, provider or photographic fidelity claims. Build
tokens/web first. The runner owns a temporary preview server and cleans it up.
"""

import json
import os
import socket
import subprocess
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = Path(os.getenv("GALLERY_TEST_ARTIFACTS", ROOT / "work/c1-b-browser"))


def assert_light(page):
    expect(page.locator("body")).to_have_attribute("data-theme", "light")
    assert page.locator("body").evaluate("""el => {
      const s = getComputedStyle(el);
      return s.backgroundColor === 'rgb(250, 251, 252)' &&
        s.color === 'rgb(14, 23, 48)' && s.colorScheme === 'light' &&
        s.getPropertyValue('--gold-300').trim() === '#a8884f';
    }""")
    assert page.locator('[data-theme="dark"]').count() == 0


def run(base):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path="/usr/bin/chromium"
            if Path("/usr/bin/chromium").exists() else None,
            headless=True,
        )
        try:
            for width, height, motion in [(1440, 1000, "no-preference"),
                                          (390, 844, "reduce")]:
                context = browser.new_context(
                    viewport={"width": width, "height": height}, reduced_motion=motion,
                )
                context.add_init_script(
                    "localStorage.setItem('illuminate-theme', 'dark')"
                )
                # Intentionally denied session fixtures, never successful identity evidence.
                context.route("**/api/**", lambda route: route.fulfill(
                    status=401, json={"detail": "Unauthenticated lifecycle fixture"},
                ))
                context.route("**/portfolio/*.jpg", lambda route: route.fulfill(
                    content_type="image/svg+xml",
                    body='<svg xmlns="http://www.w3.org/2000/svg" width="600" '
                         'height="800"><rect width="600" height="800" fill="#777"/></svg>',
                ))
                context.route("https://images.unsplash.com/**", lambda route: route.fulfill(
                    content_type="image/svg+xml", body='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"/>',
                ))
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error, captured=errors: captured.append(str(error)))
                try:
                    page.goto(base, wait_until="networkidle")
                    assert_light(page)
                    assert not page.get_by_role("button", name="Switch to dark theme").count()
                    hero = page.get_by_role("region", name="Photography session slideshow")
                    labels = ["The studio", "Weddings", "Events", "Family portraits", "Maternity", "Newborn", "Pets"]
                    expect(hero.get_by_role("heading", level=1)).to_have_text("Editorial photography for the days that matter.")
                    # Real interval: desktop advances; reduced-motion stays still.
                    page.mouse.move(0, 0)
                    page.wait_for_timeout(7000)
                    expected_title = ("Weddings, photographed as the day unfolds."
                                      if motion == "no-preference" else
                                      "Editorial photography for the days that matter.")
                    expect(hero.get_by_role("heading", level=1)).to_have_text(expected_title)
                    for label in labels:
                        hero.get_by_role("button", name="Show " + label, exact=True).click()
                        expect(hero.locator(".eyebrow")).to_contain_text(label)
                        expect(hero.get_by_role("button", name="Show " + label, exact=True)).to_have_attribute("aria-pressed", "true")
                    hero.get_by_role("button", name="Next session", exact=True).click()
                    expect(hero.get_by_role("heading", level=1)).to_have_text("Editorial photography for the days that matter.")
                    hero.get_by_role("button", name="View The studio sample photograph", exact=True).focus()
                    page.keyboard.press("Enter")
                    expect(page.get_by_role("dialog")).to_be_visible()
                    expect(page.get_by_role("dialog").locator('[aria-live="polite"]')).to_have_text("1 / 7")
                    page.keyboard.press("Escape")
                    expect(page.get_by_role("dialog")).to_have_count(0)
                    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
                    categories = page.locator(".reel-frame small").all_text_contents()
                    assert {"Wedding", "Portrait", "Family", "Editorial", "Brand & commercial"}.issubset(set(categories))
                    pause = page.get_by_role("button", name="Pause portfolio slideshow")
                    expect(pause).to_have_attribute("aria-pressed", "false")
                    pause.click()
                    play = page.get_by_role("button", name="Play portfolio slideshow")
                    expect(play).to_have_attribute("aria-pressed", "true")
                    play.click()
                    expect(pause).to_have_attribute("aria-pressed", "false")
                    opener = page.get_by_role("button", name="View A place at the table", exact=True)
                    opener.scroll_into_view_if_needed()
                    page.evaluate("document.querySelector('.gallery-reel').scrollLeft = 0")
                    # Mouse and keyboard openings must preserve the same scroll and opener.
                    for dismissal in ["Escape", "button", "Escape"]:
                        opener.focus()
                        before = page.evaluate("({x: scrollX, y: scrollY, reel: document.querySelector('.gallery-reel').scrollLeft})")
                        overflow = page.locator("body").evaluate("el => el.style.overflow")
                        if dismissal == "button":
                            opener.click()
                        else:
                            page.keyboard.press("Enter")
                        viewer = page.get_by_role("dialog")
                        expect(viewer).to_be_visible()
                        expect(viewer).to_have_attribute("data-theme", "dark")
                        assert viewer.evaluate("""el => {
                          const s = getComputedStyle(el);
                          return s.backgroundColor === 'rgb(10, 10, 10)' &&
                            s.color === 'rgb(244, 235, 217)' && s.colorScheme === 'dark' &&
                            s.getPropertyValue('--gold-300').trim() === '#c9a96e' &&
                            s.getPropertyValue('--sage-100').trim() === '#4a5440' &&
                            getComputedStyle(el.querySelector('.lightbox-controls button')).color === 'rgb(244, 235, 217)';
                        }""")
                        # Ordinary content and root inline variables stay light while open.
                        assert page.locator("body").evaluate(
                            "el => getComputedStyle(el).backgroundColor === 'rgb(250, 251, 252)'"
                        )
                        expect(page.locator("body")).to_have_attribute("data-theme", "light")
                        assert page.locator("body").evaluate("el => el.style.overflow") == "hidden"
                        for _ in range(5):
                            page.keyboard.press("Tab")
                            assert viewer.evaluate("el => el.contains(document.activeElement)")
                        page.keyboard.press("Shift+Tab")
                        assert viewer.evaluate("el => el.contains(document.activeElement)")
                        page.keyboard.press("ArrowRight")
                        expect(viewer).to_contain_text("In your own light")
                        viewer.get_by_role("button", name="Previous", exact=True).click()
                        expect(viewer).to_contain_text("A place at the table")
                        page.keyboard.press("ArrowLeft")
                        expect(viewer.locator('[aria-live="polite"]')).to_have_text("10 / 10")
                        viewer.get_by_role("button", name="Next", exact=True).click()
                        expect(viewer).to_contain_text("A place at the table")
                        assert viewer.get_by_role("button", name="Close dialog").evaluate(
                            "el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }"
                        )
                        assert viewer.get_by_role("button", name="Next", exact=True).evaluate(
                            "el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }"
                        )
                        page.screenshot(path=str(ARTIFACTS / f"gallery-{width}-{dismissal}.png"))
                        if dismissal == "button":
                            viewer.get_by_role("button", name="Close dialog").click()
                        else:
                            page.keyboard.press("Escape")
                        expect(viewer).to_have_count(0)
                        expect(opener).to_be_focused()
                        assert_light(page)
                        assert page.locator("body").evaluate("el => el.style.overflow") == overflow
                        after = page.evaluate("({x: scrollX, y: scrollY, reel: document.querySelector('.gallery-reel').scrollLeft})")
                        assert after == before, (before, after)

                    # Preserve a nonzero horizontal reel position and the last opener.
                    last = page.get_by_role("button", name="View A new beginning", exact=True)
                    last.focus()
                    horizontal = page.locator(".gallery-reel").evaluate("el => el.scrollLeft")
                    assert horizontal > 0
                    page.keyboard.press("Enter")
                    expect(page.get_by_role("dialog")).to_be_visible()
                    page.keyboard.press("ArrowRight")
                    expect(page.get_by_role("dialog")).to_contain_text("A place at the table")
                    page.keyboard.press("Escape")
                    expect(last).to_be_focused()
                    assert page.locator(".gallery-reel").evaluate("el => el.scrollLeft") == horizontal
                    assert_light(page)

                    # A normal dialog retains light tokens and backdrop dismissal/return.
                    enquire = page.locator(".footer-actions").get_by_role("button", name="Reserve a date", exact=True)
                    enquire.click()
                    booking = page.get_by_role("dialog")
                    expect(booking).to_have_attribute("data-theme", "light")
                    assert page.locator(".studio-page").evaluate("el => getComputedStyle(el).userSelect") == "none"
                    assert booking.locator("input[name=name]").evaluate("el => getComputedStyle(el).userSelect") == "text"
                    assert booking.evaluate("el => getComputedStyle(el).backgroundColor") == "rgb(255, 255, 255)"
                    page.mouse.click(1, 1)
                    expect(booking).to_have_count(0)
                    expect(enquire).to_be_focused()
                    assert_light(page)

                    # Actual client-side history navigation unmounts an open viewer.
                    page.goto(base + "/client", wait_until="networkidle")
                    expect(page.get_by_role("heading", name="Client sign-in")).to_be_visible()
                    page.get_by_role("link", name="Back to the studio", exact=True).click()
                    expect(page).to_have_url(base + "/")
                    opener.click()
                    expect(page.get_by_role("dialog")).to_be_visible()
                    page.go_back(wait_until="networkidle")
                    expect(page.get_by_role("heading", name="Client sign-in")).to_be_visible()
                    expect(page.get_by_role("dialog")).to_have_count(0)
                    assert_light(page)
                    assert page.locator("body").evaluate("el => el.style.overflow") == ""
                    page.go_forward(wait_until="networkidle")
                    expect(page).to_have_url(base + "/")
                    assert_light(page)
                    opener.click()
                    expect(page.get_by_role("dialog")).to_be_visible()
                    page.reload(wait_until="networkidle")
                    assert_light(page)
                    assert page.locator("body").evaluate("el => el.style.overflow") == ""
                    for route, heading in [
                        ("/studio", "Studio sign-in"),
                        ("/studio/enquiries/example", "Studio sign-in"),
                        ("/client", "Client sign-in"),
                        ("/client/home", "Client sign-in"),
                        ("/no-such-page", "Page not found"),
                    ]:
                        page.goto(base + route, wait_until="networkidle")
                        expect(page.get_by_role("heading", name=heading, exact=True)).to_be_visible()
                        assert_light(page)
                        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
                    assert not errors, errors
                    print(f"PASS {width}x{height} {motion}: lifecycle, computed themes, focus/scroll, history/reload, ordinary routes", flush=True)
                except Exception:
                    page.screenshot(path=str(ARTIFACTS / f"failure-{width}.png"))
                    (ARTIFACTS / f"failure-{width}.txt").write_text(page.content())
                    raise
                finally:
                    context.close()
            # Additional hero geometry: narrow phone, portrait tablet and constrained landscape.
            for width, height in [(320, 568), (768, 1024), (1024, 600)]:
                context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
                context.route("**/api/**", lambda route: route.fulfill(status=401, json={"detail": "Denied fixture"}))
                context.route("**/portfolio/*.jpg", lambda route: route.fulfill(content_type="image/svg+xml", body='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"/>'))
                context.route("https://images.unsplash.com/**", lambda route: route.fulfill(content_type="image/svg+xml", body='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"/>'))
                page = context.new_page()
                try:
                    page.goto(base, wait_until="networkidle")
                    hero = page.get_by_role("region", name="Photography session slideshow")
                    for category in ["The studio", "Weddings", "Events", "Family portraits", "Maternity", "Newborn", "Pets"]:
                        hero.get_by_role("button", name="Show " + category, exact=True).click()
                        expect(hero.locator(".eyebrow")).to_contain_text(category)
                        expect(hero.locator(".hero-actions")).to_have_count(0)
                        expect(hero.get_by_role("button", name="Reserve a date", exact=True)).to_have_count(0)
                        expect(hero.get_by_role("button", name="Enquire with Luma", exact=True)).to_have_count(0)
                        expect(hero.get_by_role("link", name="Client sign-in", exact=True)).to_have_count(0)
                        for control in hero.locator(".hero-session-controls button, .hero-access-controls button, .hero-session-tabs button").all():
                            assert control.evaluate("el => {const r=el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height >= 44 && r.width >= 44;}")
                    assert hero.locator(".hero-photo-button").evaluate("el => el.getBoundingClientRect().height >= 200")
                    expect(hero.locator("img.is-active")).to_have_attribute("aria-hidden", "false")
                    hero.get_by_role("button", name="View Pets sample photograph", exact=True).click()
                    viewer = page.get_by_role("dialog")
                    expect(viewer).to_be_visible()
                    expect(viewer.locator('[aria-live="polite"]')).to_have_text("7 / 7")
                    page.keyboard.press("ArrowRight")
                    expect(viewer.locator('[aria-live="polite"]')).to_have_text("1 / 7")
                    page.keyboard.press("Escape")
                    expect(viewer).to_have_count(0)
                    assert_light(page)
                    page.screenshot(path=str(ARTIFACTS / f"hero-{width}x{height}.png"))
                    print(f"PASS hero {width}x{height}: seven categories, reachable controls, viewer wrap and close", flush=True)
                finally:
                    context.close()
            # Public composition acceptance, independently specified by the _ds marketing
            # block and universal web matrix. Real assets in CI; API denied deliberately.
            checkpoints = [(375, 812), (812, 375), (390, 844), (844, 390),
                           (428, 926), (926, 428), (744, 1133), (1133, 744),
                           (834, 1194), (1194, 834), (1152, 1400), (1152, 900),
                           (1280, 700), (1440, 900), (1920, 1080), (2560, 1080),
                           (320, 568), (768, 1024), (1024, 600)]
            context = browser.new_context(reduced_motion="reduce")
            context.route("**/api/**", lambda route: route.fulfill(status=401, json={"detail": "Denied fixture"}))
            context.route("https://images.unsplash.com/**", lambda route: route.fulfill(content_type="image/svg+xml", body='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"/>'))
            page = context.new_page()
            page.goto(base, wait_until="networkidle")
            for width, height in checkpoints:
                page.set_viewport_size({"width": width, "height": height})
                page.evaluate("scrollTo({top:0,behavior:'instant'})")
                header = page.locator(".marketing-header")
                hero = page.get_by_role("region", name="Photography session slideshow")
                assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), (width, height)
                assert header.evaluate("el => getComputedStyle(el).position === 'sticky' && el.getBoundingClientRect().height >= 64")
                assert hero.evaluate("el => { const r=el.getBoundingClientRect(); return Math.abs(r.left)<1 && Math.abs(r.width-innerWidth)<1; }")
                expected_dir = "row" if width >= 900 and width > height else "column"
                assert hero.evaluate("el => getComputedStyle(el).flexDirection") == expected_dir
                assert hero.locator("h1").evaluate("el => getComputedStyle(el).fontFamily.includes('Cormorant') && parseFloat(getComputedStyle(el).fontSize)<=50")
                assert hero.locator(".hero-brand-banner").evaluate("el => el.complete && el.naturalWidth>0"), "Missing reference banner"
                assert page.locator(".marketing-brand img").evaluate("el => el.complete && el.naturalWidth>0"), "Missing reference lens"
                assert page.locator(".experience-grid article").count() == 4
                assert page.locator(".collection-card").count() == 3
                for card in page.locator(".collection-card").all():
                    assert card.locator("ul").evaluate("el => { const s=getComputedStyle(el); return s.display==='flex' && s.flexDirection==='column'; }")
                    assert card.get_by_role("button").evaluate("el => Math.abs(el.getBoundingClientRect().width-el.parentElement.clientWidth+40)<2")
                assert page.locator(".collection-card.featured").evaluate("el => getComputedStyle(el).marginTop==='0px' && getComputedStyle(el).backgroundImage==='none'")
                assert page.locator(".print-preview-grid figure").count() == 3
                page.locator(".print-preview-grid").scroll_into_view_if_needed()
                for photo in page.locator(".print-preview-grid img").all():
                    expect(photo).to_have_js_property("complete", True)
                    assert photo.evaluate("el => el.naturalWidth>0")
                page.evaluate("scrollTo({top:0,behavior:'instant'})")
                for selector, expected in [(".experience-grid", 4 if width>=940 else 2 if width>=560 else 1),
                                           (".collections-grid", 3 if width>=1000 else 2 if width>=660 else 1),
                                           (".print-preview-grid", 1 if width<460 else 3)]:
                    cols = page.locator(selector).evaluate("el => getComputedStyle(el).gridTemplateColumns.split(' ').length")
                    assert cols == expected, (width, selector, cols, expected)
                expect(hero.locator(".hero-actions")).to_have_count(0)
                for control in hero.locator("button").all():
                    assert control.evaluate("el => {const r=el.getBoundingClientRect(); return r.width>=44 && r.height>=44 && r.left>=0 && r.right<=innerWidth;}")
                if width < 1152:
                    page.get_by_role("button", name="Open menu", exact=True).click()
                    expect(page.get_by_role("navigation", name="Main navigation")).to_be_visible()
                    page.get_by_role("link", name="Experience", exact=True).click()
                    expect(page.get_by_role("button", name="Open menu", exact=True)).to_have_attribute("aria-expanded", "false")
                    page.evaluate("scrollTo({top:0,behavior:'instant'})")
                page.screenshot(path=str(ARTIFACTS / f"marketing-{width}x{height}.png"), full_page=True)
            # Intermediate geometry on both axes, including every layout boundary.
            for width in sorted(set(range(375, 2561, 47)) | {459,460,559,560,659,660,899,900,939,940,999,1000,1151,1152}):
                for height in [375, 844, 1194]:
                    page.set_viewport_size({"width": width, "height": height})
                    assert not page.evaluate("document.documentElement.scrollWidth>innerWidth"), (width,height)
            # A failed family sample must not become a wedding photograph.
            page.set_viewport_size({"width": 390, "height": 844})
            page.route("**/photo-1511895426328-dc8714191300*", lambda route: route.abort())
            page.reload(wait_until="networkidle")
            family = page.get_by_role("button", name="View All together", exact=True)
            family.scroll_into_view_if_needed()
            expect(family).to_contain_text("Family sample image unavailable")
            assert family.locator("img").count() == 0
            context.close()
            print("PASS public composition: full _ds web matrix, intermediate range/orientation sampling, banner/lens, cards, print preview, navigation and honest asset failure", flush=True)
        finally:
            browser.close()


def main():
    if not (ROOT / "web/build/index.html").is_file():
        raise RuntimeError("Build the production workspace before gallery verification")
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    (ARTIFACTS / "result.json").unlink(missing_ok=True)
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    with (ARTIFACTS / "preview.log").open("w") as log:
        process = subprocess.Popen(
            ["node", str(next(p for p in (ROOT / "web/node_modules/vite/bin/vite.js", ROOT / "node_modules/vite/bin/vite.js") if p.is_file())), "preview", "--host", "127.0.0.1",
             "--port", str(port), "--strictPort"],
            cwd=ROOT / "web", stdout=log, stderr=log,
        )
        try:
            base = f"http://127.0.0.1:{port}"
            for _ in range(100):
                if process.poll() is not None:
                    raise RuntimeError("Production preview exited during startup")
                try:
                    with urlopen(base, timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    pass
                time.sleep(0.1)
            else:
                raise RuntimeError("Production preview did not become ready")
            run(base)
            (ARTIFACTS / "result.json").write_text(json.dumps({
                "status": "passed", "bundle": "web/build", "widths": [1440, 390, 320, 768, 1024],
                "database": "not used", "api": "unauthenticated denial fixture",
                "images": "SVG fixtures; no photographic fidelity claim",
            }, indent=2) + "\n")
        finally:
            process.terminate()
            process.wait(timeout=10)


if __name__ == "__main__":
    main()
