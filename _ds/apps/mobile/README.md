# @illuminate/mobile

Studio Suite **mobile app** — Expo (React Native) with **Expo Router**. Mobile-first,
built to the Universal Responsive Design Requirement: every screen adapts continuously
across handset ↔ tablet and both orientations from **measured runtime geometry**.

## Run

```bash
npm install          # from repo root (workspaces)
npm run mobile       # or: npm run start --workspace @illuminate/mobile
```

Press `i` / `a` for iOS / Android, or scan the QR with Expo Go.
`npm run typecheck --workspace @illuminate/mobile` for TypeScript.

> Orientation is intentionally **unlocked** (`app.json → orientation: "default"`,
> `ios.requireFullScreen: false`, `android.resizeableActivity: true`). A locked
> orientation would make the responsive requirement unsatisfiable by construction.

## Directory structure (Expo Router)

```
apps/mobile/
├── app.json                Expo config — orientation unlocked, expo-router plugin, typed routes
├── babel.config.js         babel-preset-expo (bundles the router plugin)
├── metro.config.js         monorepo-aware resolver (watches @illuminate/tokens)
├── tsconfig.json           strict + path aliases (~/*  →  src/*)
├── expo-env.d.ts           typed-routes reference
├── app/                    ← FILE-BASED ROUTES
│   ├── _layout.tsx         root: providers (SafeArea → Theme → Session → Luma) + Stack + fonts
│   ├── index.tsx           persona redirect (public → marketing, client/admin → portal)
│   ├── marketing.tsx       PUBLIC landing — hero, Selected Frames reel, process, collections, prints
│   ├── sign-in.tsx         split-screen auth, role toggle
│   ├── +not-found.tsx
│   ├── (client)/           CLIENT PORTAL group
│   │   ├── _layout.tsx     AppShell — adaptive nav (bottom tabs ↔ side rail), unread badge
│   │   ├── home.tsx        countdown hero, phase tracker, quick access
│   │   ├── gallery.tsx     lights-out proof grid, selections folder, frame viewer
│   │   ├── inbox.tsx       correspondence + in-portal e-signature (two-pane ≥ 900pt)
│   │   ├── documents.tsx   filed contracts, releases, schedules
│   │   ├── prints.tsx      print collection wall + fine-art sizes (lights-out)
│   │   ├── intake.tsx      pre-shoot questionnaire (shared IntakeScreen)
│   │   └── profile.tsx     identity, event facts, links to inbox/documents
│   └── (admin)/            STUDIO ADMIN group
│       ├── _layout.tsx      AppShell — admin nav, wrapped in FinanceProvider
│       ├── dashboard.tsx    KPI strip, upcoming shoots, inquiries
│       ├── bookings.tsx     master/detail (two-pane wide · bottom-sheet compact)
│       ├── inquiries.tsx    triage — accept, decline, reply
│       ├── tracker.tsx      shoot phase lanes
│       ├── contacts.tsx     client directory
│       ├── documents.tsx    filed documents + template library
│       ├── finance.tsx      Overview · Invoices · Expenses · GST & BAS · Reports · Accounts
│       └── content.tsx      site content blocks
└── src/
    ├── theme/              ThemeProvider + useTokens (binds @illuminate/tokens to RN)
    ├── state/session.tsx   auth + role context
    ├── state/portal.tsx    client portal state — inbox, filed documents, selections
    ├── state/finance.tsx   bookkeeping settings, expense register, audit trail
    ├── hooks/useResponsive.ts   the Mechanism-Law geometry hook (useWindowDimensions)
    ├── data/seed.ts        mock data mirroring apps/web data.jsx
    ├── data/finance.ts     AU bookkeeping engine — GST/BAS, P&L, super, depreciation, ledger
    └── components/         Icon · ui (Button/Card/Badge/…) · AppShell · Luma · IntakeScreen ·
                            BookingDetail · finance/ (register, audit trail, BAS, reports, accounts)
```

## How responsiveness works (Mechanism Law)

- **`useResponsive()`** is the single source of layout geometry. It reads
  `useWindowDimensions()` — a subscribed, re-rendering source — so width, height,
  and orientation update instantly on rotation and split-view resize. No device-model
  branching; device *class* is only a refinement.
- **Type + spacing** interpolate through `fs()` / `gutter` off the shared
  `@illuminate/tokens` scale (the native analogue of web `clamp()`), never hard-coded.
- **`AppShell`** picks the navigation layout from measured width: **bottom tab bar**
  under 760pt, **side rail** (icon-only < 1000pt, labelled ≥ 1000pt) above. Tablet is a
  distinct two-pane layout (see `bookings.tsx`), not a stretched phone.
- **Safe areas** via `react-native-safe-area-context`; **keyboard** via
  `KeyboardAvoidingView` (Luma, intake). Tap targets ≥ 44pt.
- **Public marketing** (`app/marketing.tsx`) is the first surface an unauthenticated
  visitor lands on: the hero splits to two columns only at ≥900pt landscape, the
  Selected Frames reel is a horizontal rail at every width, and the process /
  collections / print grids reflow by column count from measured width. Luma's opener
  is persona-resolved (public visitor · client · studio) from session state.
- **Lights-out** dark theme is gated to the gallery and print-collection screens
  (`useFocusEffect` sets it on focus, restores light on blur) — mirrors the web
  `darkAllowed` rule, which allows dark for gallery-type viewing only.
- **Client portal surfaces** follow the web portal's module set: Overview, Gallery
  (folder model — a selected frame moves out of All proofs), Inbox (signing a
  release files it into Documents and clears it from the inbox), Documents, and
  the Print Collection wall. `src/state/portal.tsx` holds that shared state so the
  inbox → documents move is one source of truth, not per-screen copies.

## Finance

`src/data/finance.ts` is the RN port of the web bookkeeping engine
(`apps/web/src/features/finance/finance-core.jsx`) — Australian small-business
rules for FY2025-26: GST at one-eleventh of a GST-inclusive amount, Simpler BAS
(G1/1A/1B) with PAYG withholding and a PAYG instalment estimate, quarterly
periods with statutory lodgment dates, 12% super guarantee, and the $20,000
instant asset write-off with the general small business pool above it. Every
figure is derived; nothing is stored. The three bookkeeping settings — GST
registration, price basis, cash/accrual — are user-selected on the Overview tab
and every calculator branches off them.

The Finance screen carries all six modules the desktop portal has: **Overview**
(KPIs, receivables, settings), **Invoices**, **Expenses**, **GST & BAS**,
**Reports** (P&L, cash flow, super, PAYG, depreciation) and **Accounts**
(general ledger, chart of accounts). Wide-table modules are re-laid as stacked
cards rather than shrunken tables; the period selector (FY · quarters · months)
is a scrolling chip rail.

**Record security.** Editing or deleting a saved expense runs a password
re-entry sequence — once to unlock the workflow, once to finalise the save or
confirm the delete — and every step, including abandoned edits and failed
password attempts, is appended to a hash-chained audit trail with actor, device,
timezone and a field-level before → after diff. `src/state/finance.tsx` exposes
only `append` and `verify`; there is no update or delete path on the log. The
Audit Trail sub-tab re-verifies the whole chain on every view ("chain intact" /
"chain broken"). Demo password: `illuminate`.

> The native log lives in memory for the session. The web build persists to
> `localStorage`; native persistence lands with the backend, since a defensible
> log must ultimately be server-held rather than device-held.

> Interactive counterpart: `StudioSuite-Mobile.dc.html` at the repo root is the live,
> browser-verifiable prototype of exactly these screens and adaptive rules.

## Acceptance gate harness

`StudioSuite-Matrix-Probe.dc.html` (repo root) is the executable form of the
Universal Responsive Viewport Matrix. It loads the prototype in a measured frame and,
for every surface × checkpoint, reports:

- **horizontal overflow** — `scrollWidth` beyond the viewport width,
- **silent clipping** — any element whose content exceeds its box without a scroll affordance,
- **sub-44px tap targets** — every `button` / `input` / `textarea` / `a` rect.

Three modes: *Re-measure grid* (all checkpoints of the selected surface, with live
thumbnails), *Sweep widths* (continuous 275→1366 pt native / 375→2560 px web, 20–25 px
steps — the no-dead-zone proof), and *Run full matrix* (17 surfaces × 19 native or 16 web
checkpoints, pass/fail per surface with offender detail).

Surfaces are addressed by query string on the prototype, so any state is reproducible:
`?role=admin&route=bookings&booking=b2`, `?route=gallery&tab=sel`, `?route=intake&step=2`,
`?route=home&sheet=luma`, `?authed=0` (public marketing), `?authed=0&view=signin`.

Defects the harness caught and that are now fixed (web prototype, mirrored to native where
they applied): bookings master track resolved to its content min-width, overflowing the
column by 16–82 px at 275–1194 pt; booking-detail quick actions rendered unstyled (25 px
tall) because the action row passed a CSS string where a style object was required; Luma
quick-reply chips (34 pt) and intake moment chips (40 pt) were under the 44 pt floor.

Also fixed: unbreakable JetBrains Mono meta strings (profile email, document meta, proof
labels, booking venue) clipped their column by up to 53 px at 275–320 pt — now
`overflow-wrap:anywhere`.

**Gate result: 595/595 clean** — all 17 surfaces × 19 native checkpoints and 17 × 16 web
checkpoints, with no horizontal overflow, no silent clipping, and no sub-44pt tap target.
The two public surfaces added with the marketing screen (*Public · Marketing*,
*Public · Marketing Luma*) measured 19/19 native and 16/16 web on their own grid runs;
the 15 portal/auth surfaces were unchanged at 525/525.

The matrix runs surface-serial / checkpoint-parallel: each checkpoint is its own frame at
its own real geometry, so a surface costs one page load rather than N resize-and-settle
cycles. Keep the harness in a foreground tab — background tabs clamp the timers it steps on.

Not covered by the harness (native-only axes — verify on device): OS font scale at maximum
(matrix rows 20–21), real safe-area insets, and live keyboard avoidance; the harness models
keyboard-raised landscape as 812×250.
