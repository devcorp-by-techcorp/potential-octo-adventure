# Studio Suite

**Illuminate Studios** — Project Definition · v2  

*The design system and operating platform behind illuminate‑my‑gallery — a boutique editorial photography studio, from first enquiry to delivered gallery.*

- **Document:** Product & Design System Definition  
- **Platform:** React (web) · Expo React Native (mobile)  
- **Source of truth:** `packages/tokens` · `styles.css`  
- **Status:** Prototype — active build  

Studio Suite is the shared design language and application set for **Illuminate Studios**, a high‑end editorial photography business. It couples a single cross‑platform token system with a suite of product surfaces — public marketing, an AI concierge, a client portal, and a full studio admin back office — so the studio can run its entire client lifecycle on one coherent, on‑brand foundation.

## 01 What it is

Two things under one name:

**The design system**  
### Studio Suite DS  
A platform‑agnostic token layer (`tokens.ts`) mirrored into CSS custom properties (`styles.css`) and a human‑readable spec (`illuminate-design-spec.json`). Themes, type, colour ramps, spacing, motion, components, responsive rules and content policy — one canonical definition intended to feed both web and native.

**The application set**  
### Illuminate Studios platform  
The products built on the DS: marketing site, Luma AI concierge, the client portal (galleries, contracts, questionnaires), and the studio admin back office (contacts, bookings, documents, finance). All demonstrated in the prototype app entry.

The aesthetic is deliberate and named: *editorial luxury* — **brass gold and cool navy ink on a cool off‑white** for everyday UI, and a **cinematic black / cream / gold** “lights‑out” mode reserved for the immersive gallery viewer. The reference point is a hand‑set magazine spread meeting a jeweller’s loupe: quiet, generous, expensive; sharp edges, thin gold rules, serif drama against a neutral body face.

## 02 Intended use case

Studio Suite runs the studio’s **complete client lifecycle** as a single continuous experience:

- **Discover** — a public editorial marketing site (hero, portfolio reel, process, pricing) that mobile visitors land on first.
- **Enquire** — **Luma**, the AI concierge, greets visitors, triages the enquiry, and can seed a tentative booking without ever over‑promising a confirmation.
- **Book** — a stepped booking flow with calendar, package selection, deposit terms and a sticky summary rail.
- **Onboard** — standardised intake questionnaires per shoot type, feeding contracts, run sheets and photographer briefs.
- **Serve** — a role‑based client portal: galleries and the lights‑out viewer, contracts and e‑signature, an inbox, documents, and booking status.
- **Operate** — a studio admin back office: contact/CRM profiles, booking management, a full Documents Center, and a finance suite with a defensible audit trail.

Audiences are three personas resolved by auth state: the **public visitor**, the **assigned client**, and the **studio manager / admin** (Victoria Caine in the seed data). Marketing is public; portal and admin screens are role‑gated.

## 03 Design foundations [In the system]

These are the canonical primitives every surface reads from. Token values are frozen at desktop width; responsiveness is layered on top and never overrides a desktop value.

### Theming

Two themes only. **Light** is the default UI (paper / navy / brass). **Dark** is the cinematic “lights‑out” palette, *reserved* for gallery‑type viewing (the client “Your Gallery” page and the Print Collection wall) and set on `<html data-theme>`. A `darkAllowed` gate keeps every other screen light regardless of remembered preference.

### Type

| Family               | Role                                                                                     |
|----------------------|------------------------------------------------------------------------------------------|
| Cinzel               | Display — wordmark, medallions, overlines on cinematic surfaces. Never body or UI labels. |
| Cormorant Garamond   | Editorial headings, contract & long‑form bodies, pull quotes.                            |
| Inter                | All functional UI, dashboards, forms, labels, eyebrows.                                  |
| JetBrains Mono       | IDs, timestamps, file paths, EXIF, kbd.                                                  |

*Max three families per page. Tabular numerals mandatory in tables, invoice rows and dashboards. Scale runs 10 → 88px; tracking is very tight on serif headings, very wide on uppercase labels.*

### Colour

Gold is the **only** brand accent (brass `#a8884f` in light, champagne `#c9a96e` in dark — per‑theme ramps, never a single shared ramp). Sage is a sparing secondary tint. Status set is success / danger / info / warning. Two permitted gold gradients (headline text, brand chips); no UI‑chrome gradients. 1px hairlines do most separation; shadows are quiet and reserved for true overlays.

### Space, shape, motion

- Spacing scale `--s-1 … --s-10` (4 → 128px); 1440px max container, 48px gutter, 280px nav, 72px topbar.
- Near‑square radii (0–4px default; 8/16px sparingly); expose the skeleton with 1px borders.
- Motion: 180ms micro‑interactions, 340ms modals, 700ms cinematic lights‑out. No springs, no parallax; 1px gold focus ring; honours `prefers-reduced-motion`.

### Component library

- **Buttons** — Primary / ghost / outline‑gold; near‑square, uppercase, wide tracking.
- **Inputs & forms** — Sharp bordered box; gold focus, no glow. Underline variant for marketing.
- **Cards** — Default / elevated / gold‑haloed featured card.
- **Badges** — Gold / success / info / muted / sage token set.
- **Dialogs** — Navy or black scrim, backdrop blur, rise animation; bottom‑sheet on mobile.
- **Detail drawers** — Shared right half‑sheet (full overlay on mobile) for profile & booking detail.
- **Navigation** — 280px sidebar, solid 72px topbar, solid marketing nav — never glass.
- **Tables** — Hairline rules, uppercase headers, tabular numerals, inset zebra.
- **Icons** — lucide‑react, 1.25 stroke, 18px, currentColor; gold for premium actions.

### Responsive, interaction lock & policy

- **Responsive system** — fluid type (`clamp()` capped at desktop maxima), fluid layout tokens, safe‑area insets, fixed‑count grid classes that only collapse below breakpoints (1024 / 768 / 560 / 400 / landscape‑short). Desktop stays byte‑identical.
- **Interaction lock** — right‑click / long‑press menu, text selection and image drag disabled app‑wide (inputs exempt), protecting client imagery.
- **Image Representation & Content Policy** — binding on all copy: never imply client images are edited / retouched / enhanced. A forbidden‑term list and approved swaps (“edited gallery” → “selected gallery”) are encoded in the spec.
- **Assets** — banner + lens logos that swap by theme, a film‑grain texture, real photographic imagery only (no hand‑drawn SVG content).

## 04 Application modules [Built]

**Public**  
### Marketing & pricing  
Editorial hero, portfolio “Selected Frames” reel, process, package pricing, print‑collection preview. First landing surface for mobile.

**Auth**  
### Sign‑in split‑screen  
Photographic panel + form; role‑based routing into client vs admin.

**Client**  
### Client portal  
Galleries + lights‑out viewer, Print Collection masonry wall, inbox correspondence, documents, contracts with e‑signature, booking status.

**Concierge**  
### Luma AI assistant  
Launcher + drawer, persona by auth state. Curated rotating opener; live replies on OpenAI GPT‑4.1 behind a policy validator, forbidden‑term / booking‑state guards, regen‑retry and safe fallback.

**Admin**  
### Studio admin shell  
Sidebar + topbar control room: inquiries, contacts, bookings, documents, finance.

**Admin · CRM**  
### Client‑profile drawer  
Identity header + KPI strip + six tabs. Every stat/doc/invoice/gallery is *derived* from the contact’s booking + phase; overview edits persist.

**Admin · Bookings**  
### Booking‑detail drawer  
Derived deposit / balance / countdown, “booked by” (Luma or staff), payment status, editable notes, quick actions — persisted.

**Admin · Docs**  
### Documents Center  
26‑template studio pack through a full merge engine (namespaced tokens, filters, `#if`/`#each`, Markdown). Grouped library, restricted/internal flags + confirm‑gate, edit vs final PDF preview.

**Intake**  
### Questionnaire system  
All six definitions (portrait, wedding, boudoir, newborn, birth, brand/corporate), status lifecycles, escalation triggers, and auto‑brief structure; boudoir + birth marked restricted.

**Admin · Finance**  
### Finance suite  
Overview, Invoices, Expenses, GST & BAS, Reports, Accounts. Password‑gated expense edit/delete with an append‑only, hash‑chained **audit trail**.

## 05 Cross‑platform architecture

The system ships from a **monorepo** with one shared token source feeding a **React (web)** app and an **Expo React Native (mobile)** app.

### Repository layout

- `packages/tokens/` — `@illuminate/tokens`, the cross‑platform source of truth (`src/tokens.ts` + barrel `index.ts`, and `illuminate-design-spec.json` mirror).
- `apps/web/` — the React web app / live prototype: `index.html` (portal) + `design-system.html` (style guide) at the app root; `src/` split into `styles/ · data/ · components/ · features/* · design-system/`, plus `assets/`, `standalone-src/` (offline‑build inputs) and `dist/`.
- `apps/mobile/` — the Expo React Native app: a scaffold that binds the shared tokens (`src/theme/` ThemeProvider + `useTokens`).
- `docs/` — handoffs, checkpoint, Luma scope, and this definition.

### The token contract

- **`tokens.ts`** holds primitives, per‑theme semantics, and platform adapters — `shadowToCSS` / `shadowToRN`, `trackingToRN`, `themeToCSSVars()`. Importable by web and native alike.
- **Web** consumes it through `styles.css`, which mirrors the tokens into CSS custom properties scoped by `[data-theme]`. **Mobile** consumes the same `themes` object directly as JS values via the theme provider.
- Eight cross‑platform conflicts surfaced during RN/web reconciliation have been resolved and logged (dead CSS‑var bridge, gold‑value disagreement, single‑ramp assumption, missing light fallback, missing warning status, theme‑unaware shadows, invalid keyframe scope, and a documented naming inversion where web `--ink-*`=surface / `--bone-*`=text but JS `ink.*`=text).

> **Current build note:** The web app currently runs as a **zero‑build React + Babel‑standalone prototype** (open `apps/web/index.html` directly; multi‑file JSX sharing state via `window.*` globals). The `features/*` layout already matches the intended **Vite + React + TS** target, so migration is mechanical (convert `window.*` sharing to real `import`/`export`). The Expo mobile app is **scaffolded** — tokens + theme wired, feature screens still to build — see §06.

## 06 Discussed but not yet integrated [Open]

Recorded here for continuity — decisions taken, deferrals, and known gaps.

### Platform & delivery

- **Expo React Native app** [Scaffolded] — the app exists and consumes the shared tokens via its ThemeProvider / `useTokens` hook, but the feature screens (mirroring the web `features/*` domains), navigation, and font loading remain to be built.
- **Server‑side Luma proxy (security)** [Must‑do before non‑dev use] — the OpenAI dev key is currently embedded in client‑side JS and publicly visible. Move the call behind a server/proxy with a server‑side env key, and rotate the embedded key.

### Luma’s workflow role [Written scope only]

Luma’s role in the documents/questionnaire workflow has been *scoped in writing* but not wired into the app. The agreed conditional rule:

- **Luma‑led intake** → Luma sends the questionnaire, collects responses, hands to the owner to finalise, then the owner grants client access on booking confirmation.
- **Owner‑led intake** → Luma acts only when explicitly instructed by the owner.

*Candidate actions still to build: send the right questionnaire on booking confirm, answer client questions during fill, generate the photographer brief, flag risk/escalation to staff, draft client docs from templates.*

### Questionnaire wiring & briefs

- Questionnaire responses are defined but not yet fully wired into `map.questionnaire.*` so run sheets / session guides / briefs resolve live (they currently render as blank fields in final mode).
- **Where photographer briefs surface** — booking card, client profile, or both — remains an **open question** for the user.
- **Prototype fidelity** of the intake — fully interactive fill+submit vs visual mock — to confirm.

### Defaults chosen (user may revisit)

- **Restricted/internal document handling** = visible badge + confirm‑gate on client‑facing use (not hidden, not hard‑gated). Data already carries `restricted` / `audience` to upgrade to gating later.

### QA & audit debt

- **Admin mobile audit** — only the client portal has had the full 5‑width responsive probe; the admin shell (beyond the detail drawers) still needs the same pass.
- **Pixel‑level visual regression** — a deterministic layout‑metric baseline exists; true per‑width pixel snapshots need an external headless‑browser run.

---

Illuminate Studios · Studio Suite  
Project Definition · v2