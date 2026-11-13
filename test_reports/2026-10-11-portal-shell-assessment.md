# Portal shell and _ds compliance assessment — 11 October 2026

**Verdict: partial implementation; rework and verification required. Full _ds
compliance has not been achieved. The portal-shell change cannot yet be accepted
as a verified responsive update.**

Assessed the working tree, uncommitted at assessment time, based on
`b7452ef57e45c6b982265c2635e6dbff88c28728`, including the three new untracked
shell/style/test files. This is a review of the implementation from this session,
not an independent reviewer sign-off or a live deployment assessment.
The user requested assessment after implementation was interrupted. No product
code was changed during this assessment.

## Findings

### A1 — Required native behavior remains absent (high; existing, unresolved)

`mobile/app.json:6` still locks the application to portrait.
`mobile/App.tsx:7` still selects a global theme from the OS preference, and
`mobile/App.tsx:17` opens portal URLs in a browser. No native workflow, measured
geometry, safe-area, keyboard or tablet-pane implementation was added.

This contradicts `_ds/uploads/Studio-Suite_Universal-Responsive-Design-Requirements.md`
sections 1, 4 and 5: equivalent web/native features, both orientations, measured
native layout and independently verified native acceptance. The web shell does
not close C4, DS-06/07, or the native portion of DS-02.

### A2 — The required portal scope is only partly implemented (high; unresolved)

`web/src/pages/Client.jsx:13` registers one navigation destination, Your enquiries.
The new shell wraps existing enquiry functionality. It does not implement the
client gallery, print collection, or the other required first-class module
surfaces in the reference. Existing enquiry-bound documents and correspondence
are not evidence of the complete reference portal.

`web/src/components/portal-shell.css:96` changes directly from desktop rail to
compact navigation. The content remains a single stacked workspace; this patch
does not provide the distinct tablet master-detail behavior required by C2's
acceptance row in `goals/GOALS.md:159`. Sign-in composition, shared forms/tables,
and full component parity also remain outside the implementation.

The change makes progress on the shared frame, but cannot close C2 or the full
product requirement. Source: `_ds/uploads/Studio-Suit_Project-Defintion.md`
sections Client portal and Studio admin shell, plus the C2 acceptance row.

### A3 — Browser acceptance has not run (high; verification blocker)

The production bundle builds, but `python web/tests/portal_shell.py` failed
before opening the application: creating the local server socket at line 184
raised `PermissionError: [Errno 1] Operation not permitted`. The subsequent
network-enabled attempt was interrupted and produced no completed result.
`work/portal-shell/result.json` is absent.

There is no completed matrix, screenshot comparison, focus/scroll lifecycle or
real-MongoDB browser-regression evidence for this working tree. Docker socket
access was also denied during setup; its additional-permission attempt was
interrupted. These are environment/verification limitations, not evidence that
the application passed or failed its rendered acceptance criteria.

The CI step in `.github/workflows/ci.yml` had not run at assessment time. A
proposed CI step is not a hosted CI result. Required next evidence is a successful frozen
production-build run and the affected real API/session regression journeys.

### A4 — The new matrix does not cover the complete acceptance contract (high; test gap)

`web/tests/portal_shell.py:75` returns 503 for almost all feature requests. The
main loop therefore exercises 13 route error states. Lines 106–115 add empty
states for four routes. Populated enquiry/booking details, document and
conversation controls, editing, loading and conflict states are not exercised
across the matrix.

The More dialog is exercised at four geometries (line 119), rather than every
relevant compact checkpoint and orientation. Screenshots are saved but never
compared with an approved reference baseline. Tests use Chromium and synthetic
API responses; they do not prove server authorization or native parity.

This is useful shell-specific coverage, but does not satisfy the universal
all-surface-state gate in the responsive requirements section 3 or C3. Even a
future pass of this test alone must not be reported as complete _ds compliance.

### A5 — Active-route selection introduces an unsupported runtime API (medium; new)

`web/src/components/PortalShell.jsx:10` calls `items.findLast(...)` without a
fallback. The production bundle retains this call. Vite 6's default build target
includes Chrome 87, Firefox 78 and Safari 14, and `web/vite.config.js` does not
override that target or install a polyfill. `Array.findLast` is newer than those
targets.

An isolated execution of the exact active-route expression with `findLast`
unavailable produced `TypeError: items.findLast is not a function`. On a runtime
without this method, rendering either authenticated shell throws. This is a
feature-availability reproduction, not an executed old-browser test.

Use a compatible selection operation or explicitly establish and enforce the
supported browser baseline. Vite syntax transformation does not polyfill this
method.

### A6 — CSS and JavaScript disagree at fractional breakpoint widths (medium; new)

CSS enables compact navigation at `max-width: 1151px`
(`web/src/components/portal-shell.css:96`), while the resize listener uses
`min-width: 1152px` (`web/src/components/PortalShell.jsx:16`). At a fractional
viewport such as 1151.5px, both conditions are false: desktop CSS applies while
the JavaScript still considers the viewport below the wide threshold.

Consequently the source does not implement disclosure at every width below
1152px. A transition from 1151px to 1151.5px can change the CSS layout without
firing the listener that closes an open navigation dialog. The integer-only
edge samples in `web/tests/portal_shell.py:33` cannot detect this mismatch.

Use one consistent threshold, preferably compact defaults overridden by
`min-width: 1152px`, and add fractional-width/zoom coverage. This finding is
established from the predicates; rendered reproduction remains pending.

## What the implementation does establish

Source review confirms that both authenticated web portals now use one shared
frame. The stylesheet specifies a 280px desktop rail, solid 72px minimum topbar,
fluid content gutters, compact primary navigation capped at four destinations,
and a More dialog. The new frame uses shared semantic colors and spacing,
18px/1.25-stroke navigation icons, 1px focus outlines and 44px minimum control
dimensions. The dialog reuses existing focus/scroll behavior.

The existing authentication, CSRF and API functions were not changed, and the
new shell is selected only after session restoration. This source review is not
a substitute for the real session-loss, logout and persistence regressions.

## Verification results

| Check | Result | Scope |
| --- | --- | --- |
| `COREPACK_HOME=/workspace/.cache/corepack corepack pnpm build` | PASS | Tokens and production web bundle; repeated during assessment |
| `COREPACK_HOME=/workspace/.cache/corepack corepack pnpm lint:web` | PASS | ESLint |
| `node scripts/check-design.mjs` | PASS | Token mirror and 25 runtime variables |
| `node scripts/check-token-compatibility.mjs` | PASS | Historical token API contract |
| `python3 scripts/audit-design-source.py` | PASS | 86 source files, 115 archive members, hashes and archive CRCs |
| Python AST parsing of `web/tests/portal_shell.py` | PASS | Syntax only |
| `git diff --check` | PASS | Whitespace/patch checks |
| Production portal browser matrix | BLOCKED / NOT RUN | Local socket creation denied; retry interrupted |
| Real-MongoDB browser regressions | NOT RUN | Isolated database unavailable |
| Reference visual comparison | NOT RUN | No rendered candidate acceptance |
| Native device matrix | NOT RUN | Native implementation unchanged and incomplete |
| Hosted CI / deployment | NOT VERIFIED | No completed result for the assessed candidate |

Assessment evidence: [build output](artifacts/2026-10-11-portal-shell-assessment/build.txt)
and [manifest](artifacts/2026-10-11-portal-shell-assessment/manifest.json). The manifest
binds the seven reviewed implementation/test/config files to SHA-256 values and
records the absent browser result. These are local-run artifacts, not hosted CI
evidence. Publishing this candidate does not resolve the findings above.

## Acceptance decision

Keep full compliance, C2 and C3 open. Correct A5/A6, extend representative
populated-state and dialog coverage, and execute the production and real API
regressions before accepting the shell increment. Complete the remaining web
module/tablet and native work before making a platform-wide compliance claim.
No merge, deployment or compliance approval follows from this assessment.
