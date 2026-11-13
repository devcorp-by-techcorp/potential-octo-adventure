# C1-B gallery theme lifecycle — 6 October 2026

Starting SHA: `76643e2e325819a887662ef8575df96086eb31d6` (fetched main,
PR #16 merge). Review branch: `codex/c1-b-gallery-theme-20261006`.
User explicitly requested proceeding to the next phase after merge. This
supersedes waiting to activate C1-B; it does not establish a hosted pass or
resolve C1-A historical API defects. C1-A compatibility and CI stay open.
Empirical skill/history and handoff publication note have been read.

Scope: C1-B / DS-02/20 under DD-01: gallery-owned dark theme, light ordinary
routes; viewer mount, photo navigation, dismiss/unmount, focus and scroll
restoration. Paths: web route theme readers, landing dialog/viewer, related CSS,
browser lifecycle regression and existing theme expectations, CI integration,
and development records. No token authority/API edits, shells, full matrix,
native implementation, domain/provider changes, merge or deployment.
Preserve `_ds`, untracked `.empirical` and booking confirmation HTTP 409.

Acceptance: token/web production build, web lint, token drift/source integrity,
production-built Chromium lifecycle at desktop/phone and reduced motion,
computed theme tokens/colors, focus containment/return, window and reel scroll,
close button/Escape/backdrop, route unmount/history/reload and ordinary route
light semantics with stale saved dark preference. Record screenshots/logs and
failed evidence. This UI-only suite uses explicit unauthenticated API fixtures;
no database writes or authentication acceptance is claimed. Available disk:
30 GB free before browser work. No database is required by this isolated suite.

Hosted checks for exact merged main `76643e2` returned Forbidden with
configured GIT_PAT selected as GH_TOKEN. No hosted success is claimed.
C1 and C1-A remain open even if local C1-B checks pass.

## Implementation and local evidence

- GalleryViewer uses `data-theme="dark"` on its Dialog; generated selector tokens
  override inherited light values on that node. No document theme writes remain
  in Dialog. Global saved-theme readers/toggle were removed from ordinary routes.
- Dialog's layout-effect cleanup restores overflow, returns focus with
  preventScroll, and restores window scroll instantly. Tab/Shift+Tab wrap within
  visible enabled controls. Fullscreen grid has heading/image/navigation rows,
  and viewer sizing wins over ordinary phone-dialog constraints.
- Installed tsup + CSS generation passed; web ESLint and Vite production build
  passed (1664 modules). The pinned pnpm launcher was avoided using installed
  tools. Final bundle uses `index-BZhat6kZ.css` and `index-BFsjH23p.js`.
- `node scripts/check-design.mjs`: exact mirror/reference and bundled generated
  values pass; 25 runtime variables resolve. `python scripts/audit-design-source.py`:
  86 source files/115 archived entries, manifest SHA/CRC pass. `_ds` and token
  package have no diff from starting main. This does not resolve historical API
  compatibility or native theme ownership.
- Changed Python Ruff checks and Markdown targets/whitespace pass.
- `GALLERY_TEST_ARTIFACTS=work/c1-b-browser-final python web/tests/gallery_theme.py`
  passes final production bundle at 1440x1000/no-preference and 390x844/reduced
  motion. Computed light body and dark viewer canvas/text/gold/sage/control
  values pass; repeated keyboard/mouse mount and Escape/close, arrows/button
  wrap, focus containment/return, nonzero window and horizontal reel restoration,
  light form/backdrop, history back/unmount/forward and reload pass. Ordinary
  landing/studio/client/fallback routes remain light with saved dark preference.
  Phone/desktop screenshots inspected; image fixtures are neutral SVGs, so no
  photographic fidelity or full matrix claim is made.
- Final lifecycle log: `work/c1-b-gallery-scroll.log`; screenshots, preview log
  and JSON receipt: `work/c1-b-browser-final/`. CI runs this suite and uploads
  lifecycle/denial diagnostics even on failure. The 14-suite runner now rejects
  absent builds and starts Vite preview rather than Vite dev.

## Broader application regression evidence

Disk remained above 28 GB free. Docker's local socket worked with supported
network permission. Started only disposable `studio-c1-b-mongo` using cached
MongoDB 7.0.16, replica set `c1b`, loopback port 27017. Verified writable primary
and actual transactional write/read/drop in `studio_c1_b_health_probe` before
real API/browser work. Tests use only `studio_suite_browser_test`, no production
URI/data. This extends local regression verification, not C3 scope.

System Chromium 151.0.7922.173 was used. Playwright 1.58.0 legacy launchers
required a workspace-local browser-path symlink to `/usr/bin/chromium`; this is
scratch setup, not a repository runtime/browser dependency change. CI installs
its pinned Playwright browser normally. No native/device evidence is claimed.

Production-built passes in separate partitions:
entry_page, studio_auth, studio_inbox (first run), client_invitations (second),
and studio_reporting, booking_drafts, conversations, studio_contacts,
public_content, enquiry_operations, documents, account_sessions,
booking_resources (all nine in third run). Thirteen existing suites passed;
this is not a passing aggregate fourteen-suite run.

`studio_bookings.py` passed its theme/width, confirmation HTTP 409, denial and
unchanged-persistence checks, then failed at the revoked-session sign-in render
assertion. Bounded diagnostic reproduced at `/studio`: screenshot and DOM show
“Checking your session…” with no Staff email field. No timeout or authorization
assertion was weakened. The four later denial modes were not executed in this failed suite; no five-mode pass is claimed.

Logs: `work/c1-b-all-browser.log`, `work/c1-b-remaining-browser.log`,
`work/c1-b-other-browser.log`, `work/c1-b-booking-diagnostic.log`;
revoked render artifacts: `work/c1-b-booking-diagnostic/`.

## Failed evidence retained

First gallery run caught Tab leaving the modal; explicit focus wrapping fixes it.
Second gallery run failed a computed close-button color expectation because
hover correctly applies brand gold; assertion now checks the unhovered navigation
control's dark text. Its image fixture initially matched external URLs, whereas
actual photos are local: corrected fixture to `/portfolio/*.jpg`. Later phone
screenshot exposed inherited ordinary-dialog max-height; increased viewer
selector specificity to retain its 100dvh height. Final suite passes, including
additional nonzero reel restoration. Logs `work/c1-b-browser-run-{1,2,3}.log`
and failure snapshot/DOM under `work/c1-b-browser/` remain available.

A root-directory ESLint invocation used relative config paths incorrectly and
reported browser globals undefined; correct web-directory lint passed. Initial
Ruff caught a loop closure capture in the new test; explicit capture fixed it.
First broad run stopped at missing Playwright bundled browser after three passes;
second failed the booking render assertion; all these outcomes are retained.

## Publication and remaining gates

CI API at exact merged main remains Forbidden. Push/remote/Empirical results
will be recorded after publication. C1-A palette/shadow historical compatibility,
native gallery-only theme rule, source conflict and full matrices remain open.
Broader booking sign-in recovery is a separate follow-up; do not modify booking
policy or disable its denial assertions to make this run green. No later run,
merge, deployment, provider or customer action is authorized by this evidence.

## Merged-baseline comparison

Built an isolated `git archive 76643e2 web` tree under
`work/c1-b-baseline/`, reusing unchanged installed dependencies and backend.
Only its runner was switched to production preview and its test received bounded
failure diagnostics; baseline product source and historical theme expectations
were unmodified. Baseline build passed (1663 modules, `index-CnCBFhQf.js`).
Its studio_bookings test fails at the same revoked-mode Staff email assertion,
same `/studio` URL and “Checking your session…” DOM/screenshot. This establishes
that the production-built failure exists on starting main; it does not establish
its root cause. Keep recovery-render diagnosis/fix separate from C1-B.
Baseline logs: `work/c1-b-baseline-build.log`, `work/c1-b-baseline-booking.log`;
artifacts: `work/c1-b-baseline-diagnostic/`.

A durable selected evidence copy is committed under
[evidence/c1-b-20261006/](evidence/c1-b-20261006/), including lifecycle/partition
logs, current and baseline denial failures, their screenshots/DOM, and final
neutral-fixture gallery screenshots/JSON. Committed text copies normalize trailing whitespace; raw scratch copies remain
under `work/`.
Final built asset SHA-256:
`8875f1041f2b2588326b5166682affc0d4e83db1fb1de9ed87ab03743fcb8eb8` (JS),
`2abe5a3768a5edd507644639fc5c82f8eb4da1acb7b0b9cf88f12367b2df99b8` (CSS).

C1-B implementation/local lifecycle gates pass. Aggregate application and
hosted gates remain open; C1 and later runs are not activated/closed. Task-owned
MongoDB container is removed after testing; no unrelated containers/data touched.

## Verified publication and Empirical receipts

Implementation/evidence commit `cca69eeb96a9bbe226fab17773929b01a8b424a4`
pushed to `codex/c1-b-gallery-theme-20261006`; `git ls-remote` equals local HEAD.
Exact implementation-head check-runs REST returned Forbidden; PR GraphQL also
returned Forbidden, so no live PR status or hosted pass is claimed. CI branch
trigger/lifecycle artifacts are configured, but remote result remains unverified.

Empirical work-history event `6ac46c1500f9510b56212609` and separate recovery
follow-up `6ac46c2200f9510b5621265c` were created as agent-authored, mass 1,
with exact Git/session metadata. Readback verified both IDs and matching commit.
This follow-up records commit carries those receipts; resolve its final SHA
through Git history/remote readback. C1-B is implemented and locally lifecycle
verified; aggregate/hosted gates and C1-A historical API defects remain open.
No later run, merge or deployment was performed.
