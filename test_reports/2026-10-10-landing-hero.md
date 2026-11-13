# Landing hero session restoration — 10 October 2026

Starting main: `6afad8ace55f484a6695a9b54e60154cd43db358`.
The user screenshot confirms a static weddings headline. PR #20 updated the
portfolio reel, while the hero remained hard-coded in Landing.jsx.

The replacement uses the seven-slide `_ds/StudioSuite-Mobile.dc.html` sequence:
studio, weddings, events, family portraits, maternity, newborn and pets. Bundled
headlines and descriptions match the reference exactly; a new CI gate
compares them directly with preserved reference source and retained original image IDs. Published studio narrative
continues to override the first description, and its published footnote is preserved.
Reference actions (reserve, Luma, client sign-in), 44×44px controls and line indicators
are restored. Added explicit pause/resume, focus/hover/reduced-motion/visibility
guards, modal suspension, swipe navigation and the existing scoped dark viewer.
Unavailable images display a neutral message instead of unrelated wedding imagery.

Verification: web ESLint, production token/web builds, token authority/historical
API checks and exact hero data comparison pass locally. Extended existing production
browser lifecycle coverage for all seven categories, wrap-around, hero viewer,
desktop/mobile overflow and existing light/dialog theme behavior. Additional hero
checks cover 320px phone, 768px portrait tablet and 1024×600 constrained landscape. Browser execution
is pending hosted CI: local Chromium downloads returned truncated archives.
Local snapshot lacks repository binary images/fonts; fixtures do not establish
photographic fidelity or visual parity. Actual cloud-browser image inspection
found reference sample mismatches (listed below).

The mission explicitly retains a light-default route and gallery-only dark viewer.
Hero layout follows the reference split condition (900px landscape), image-first
wide composition and compact background/scrim, adapted to light route tokens.
Full visual parity remains unverified and must not be reported as complete. No `_ds` source changes.
No deployment or live acceptance is claimed for this change. Railway API access
previously returned HTTP 403 / 1010, and dashboard sign-in was unresolved; the user
manually deployed the prior main version. A new preview release and actual browser
verification are still required after integration.

## Reference image corrections

The mission explicitly requires replacing mismatched illustrative assets. Actual
cloud-browser screenshots showed: reference Family is adults raising wine glasses;
Maternity is a bride and groom with guests; Newborn is an empty wedding venue;
Pets is a wedding couple. Preserved `_ds` bytes and retained `referenceImageId`
in the catalog while replacing those four assignments with visually verified
category-appropriate free Unsplash samples. Events reference shows a banquet table
and remains suitable event detail. Studio/Weddings use existing local samples.

| Session | Original reference ID | Replacement ID | Verified content/source |
| --- | --- | --- | --- |
| Family portraits | 1519671482749-fd09be7ccebf | 1511895426328-dc8714191300 | Family holding hands at sunset; existing portfolio sample, viewed live |
| Maternity | 1583939411023-14783179e581 | 1558636411-95b6f3dbfa6a | Pregnant woman; Anna Civolani, https://unsplash.com/photos/huDTBofrOZE |
| Newborn | 1523438885200-e635ba2c371e | 1535571393765-ea44927160be | Mother holding baby; Zach Lucero, https://unsplash.com/photos/fwjsBPbRm4g |
| Pets | 1591604466107-ec97de577aff | 1552053831-71594a27632d | Dog holding flower; Richard Brutyo, https://unsplash.com/photos/Sg3XwuEpybU |

Maternity/newborn source pages state free use under the Unsplash License; pet
source was checked through official public search and the photograph viewed in
browser. External URLs load in cloud browser, but outage behavior remains neutral.
The catalog and enlarged viewer use the same selected photograph. Samples are
explicitly labelled; no client-work or operational fulfilment claims are made.

## Live baseline after user manual deployment

Cloud browser now opens the preview successfully. Its portfolio shows all ten
frames across five categories and viewer navigation works from portrait to family;
its hero still displays the static weddings heading. This confirms the hero source
defect independently of the earlier stale deployment, and is not acceptance of
this PR's unreleased hero.

Empirical work-history receipt: `6ac9cfce6705457911c94892`.

Reference indicators retain 34px visual lines within 44px targets; they wrap on
constrained widths to satisfy the written target/reachability requirement. Swipe
suppresses its following click so dragging an image does not open the viewer.

The hero also restores the source image stack: 900ms crossfade and 7000ms gentle
zoom; reduced motion disables both. Browser geometry assertions guard against
collapsed image layers in the wide split composition.
