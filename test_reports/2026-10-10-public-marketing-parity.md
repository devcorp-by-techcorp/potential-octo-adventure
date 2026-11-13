# Public marketing parity correction — 10 October 2026

## Trigger and boundary

User rejected the live PR23 landing page as not adhering to `_ds`. Direct live
screenshot confirmed seven hero sessions were deployed but the legacy large
navigation, inset hero, six-step experience, collections composition and missing
print preview remained. PR23 and green CI did not establish visual acceptance.
Starting main: `1154413dc2c48276cbe190ec6d919579aeb2eca4`.

This correction covers the public landing surface and its existing enquiry,
Luma and gallery entry points. It does not close the broader native/admin/client
feature programme. `_ds` bytes are preserved.

## Parity register

| Finding | Reference | Correction / verification |
| --- | --- | --- |
| Legacy 116px header and section navigation | HTML marketing header, 2224–2231 | Solid sticky compact header; lens, wordmark, Luma, reserve and sign-in. Section disclosure below written 1152px fit floor retained. |
| Inset hero and improvised wordmark | HTML hero, 2233–2269 | Full-width composition, exact reference banner copied from existing `_ds` blob; landscape split at width >=900, compact scrim; existing seven slides and viewer retained. |
| Controls outside reference composition | HTML indicators, 2255–2266 | Previous/next, seven indicators and padded count grouped. Separate accessible pause/view controls retained; 44px targets supersede narrower prototype indicators. |
| Oversized alternating reel | HTML selected frames, 2272–2290 | Reference fluid 200–320px frame widths, captions, near-square borders, snap/overflow layout. Honest diverse sample labels retained. Failed images show unavailable, never wedding fallback. |
| Six unsupported legacy process panels | HTML process, 2292–2303 | Four Enquire/Book/Prepare/Receive cards; reference column thresholds 560/940. Accurate tentative language replaces prototype-only operational promises. |
| Legacy collections and inclusions | HTML collections, 2305–2334, PACKAGES 3195 | Exact reference catalog, audiences and inclusions, same indicative prices, compact cards and Most chosen badge. Matching Luma prompt avoids conflicting package descriptions. |
| Missing print preview and legacy quote/contact sections | HTML prints/footer, 2336–2361 | Three photographic print previews, reference spacing and compact footer. Existing real contact address and studio link retained rather than fictional seeded contact details. Custom published narrative remains rendered in a studio note. |
| Non-reference targets/focus/icons/sheet | Written foundations and universal requirements; reserve geometry vars | Scoped 44px controls, 1px focus, Lucide 1.25 stroke, reference enquiry sheet dimensions/safe areas, gallery-only dark preserved. |

## Source conflicts and operational boundaries

On 11 October the owner explicitly removed the three hero action buttons
(Reserve a date, Enquire with Luma and Client sign-in) in PR25. Integration with
main preserves that decision alongside this composition: hero controls remain,
with enquiry, Luma and sign-in entry points elsewhere on the landing page.
The dialog lifecycle check uses the footer reserve button, available at all
tested widths, rather than the removed hero or the narrow-screen hidden header
reserve button. Existing checks assert the hero actions remain absent.

Written definition and current mission require light-default ordinary pages and
gallery-scoped dark, overriding HTML's hardcoded black marketing example.
Colours are inherited from the shared token bridge; no second palette is added.
The written max-three-families rule takes precedence over the prototype's fourth
mono face: counters retain tabular Inter numerals. Prototype 30% retainer conflicts
with approved IS-BOOK-AUTH-003 10% default; no prototype retainer or fictional
signed-intake capabilities are published. Backend confirmation and permissions
are unchanged. Print previews create no order/payment capability.

## Verification

Local web ESLint and production build pass. Hero/reference, token authority and
historical API checks pass. New catalog/headings guard compares actual `_ds` data.
Hosted CI must run the complete application regressions and new public composition
checks: all 16 web matrix rows, three extra geometries, intermediate widths on
three height axes, header/hero/grid/font geometry, real banner/lens loading,
section disclosure, honest failed-family image, existing gallery lifecycle and
Luma/enquiry/public-content suites. CI screenshots include full-page marketing
captures; API-denied/external-image fixtures do not claim live provider or
photographic fidelity. Local snapshot lacks full repo assets/browser/database;
full source-integrity and runtime gates are hosted, not claimed locally.

Integration, exact-head CI, Railway deployment and actual live visual acceptance
are pending. This report is an implementation checkpoint, not release sign-off.
