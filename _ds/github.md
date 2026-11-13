repo: techcorp-DevApps/studio-suite
branch: main
path: design-system/components

## Last sync
date: 2026-08-03T06:05:00Z

### Updated in this project
- **Public "Reserve a Date" now exists on mobile** (parity open item A): a three-step sheet
  — live month calendar (Monday-first, dates the studio already holds struck through and
  refused, past dates refused), session type and collection; then name, email, phone, venue
  and a note; then a reference number and the two-working-day promise. It is a bottom sheet
  on a handset and a centred panel once there is width. Entry points mirror desktop: topnav
  (≥560px), hero, every collection card ("Reserve Signature" preselects the collection) and
  the footer.
- A submitted enquiry is a real record: it enters studio-admin Inquiries as "new", raises the
  rail badge, and Accept & create booking converts it as before.
- **New booking / Add contact built for real** (parity open item C): the desktop's decorative
  header buttons are working inline forms on Bookings and Contacts, in the Studio Staff form
  grammar (gold-bordered card, chip rails, validation as a toast plus a pinned message).
  A booking validates name, ISO date and fee, carries the collection's published fee across,
  enters the schedule at phase one, and adds an unknown client to the contact book with it.
  A contact validates name and a unique email; a portal account requires a linked booking.
- Bookings and inquiries now persist alongside the other registers, and the seed assignment
  no longer clobbers restored records — `contacts` was being overwritten on every load.
  The store key moved to `studiosuite.v2`: the key set changed, so a v1 blob is a stale
  schema. The old value is orphaned, not deleted.
- Schedule naming fixed: new bookings read "Haddad · Noor", not "Haddad · Noor Haddad"
  (`acceptInq` had the same duplication).
- Gate: new **collapsed scroll container** check — a scroll container is a flex item whose
  `min-height:auto` resolves to 0, so inside a height-constrained column it can shrink past
  its content to nothing while every other check still reads clean. That is exactly what hid
  the reserve calendar (a 2px box holding 295px of grid) until the sheet's children were
  pinned with `flex:none`. The check is confirmed to fire on the defect and stay silent once
  fixed.
- Gate: new **collapsed scroll container** check — a scroll container is a flex item whose
  `min-height:auto` resolves to 0, so inside a height-constrained column it can shrink past
  its content to nothing while every other check still reads clean. That is what hid the
  reserve calendar (a 2px box holding 295px of grid) until the sheet's children were pinned
  with `flex:none`. Confirmed to fire on the defect and stay silent once fixed.
- Gate: the tap-target floor no longer flags a link inside a sentence of running text
  (WCAG 2.5.8 exempts it; padding it to 44px would wreck the line box). "Crawl new surfaces"
  now covers Public · marketing, Admin · bookings and Admin · contacts — passing, 0 blocking
  findings across 6 surface runs.

### Previous sync (2026-08-03T00:00Z)
- **Finance and register persistence closed** (parity open item B): the prototype now keeps
  bookkeeping settings, the expense register, manually raised invoices, payment overrides,
  the hash-chained audit log, the selected period and the studio registers (staff, roster,
  suppliers, contacts, inbox, filed documents, gallery selections) in `localStorage` under
  `studiosuite.v1`, matching desktop. Transient UI — sheets, drafts, searches, password
  gates — is deliberately not stored.
- The acceptance gate loads every surface with `&nopersist=1`, so its synthetic clicks never
  enter the studio's stored books.
- Gate coverage extended to the surfaces added since the last full pass: Studio Staff
  (roster + contracts) and Finance → Suppliers, plus deep links for every finance tab
  (`?fin=…`) and the staff segments (`?seg=contracts`), and a "Crawl new surfaces" run.
- Gate reliability: waits now key off a `data-vw` signal the app publishes once it has laid
  out for a width, instead of guessing at frame counts; a throw inside a crawl is reported
  instead of silently freezing the run.
- Fixed: the staff and supplier form chips (engagement type, pay basis, agreement type,
  contract status) were 42px tall — now 44px, clearing the tap-target floor.

### Previous sync (2026-08-02T09:05Z)
- New studio-admin surface **Studio Staff** (`route=staff`, ninth in the rail): employment
  roster with name, hired position, engagement type, pay basis + rate, rostered hours,
  superannuation, award classification, contact and ABN, plus a Contracts tab (agreement
  type, reference, signed/expiry, status and the send-for-signature / renewal actions).
  Add and edit forms validate; leavers are ended and retained, never deleted.
- **Site Content → Studio identity**: required name/title/email/phone inputs for the Studio
  Manager and Principal / Lead Photographer (Business Manager optional). Luma greets the
  signed-in user by the Studio Manager name — the card previews the exact greeting live, and
  a blank required name is flagged rather than silently greeting an empty string. Identity
  and roster records for the same person stay in step in both directions.
- **Finance → Suppliers** tab: supplier and service-partner register with entity type,
  ABN and/or ACN (validated 11/9 digits), GST status, registered address, business phone
  and email, contact name/position/number/email, payment terms, account number, and a
  repeatable list of goods and services supplied with cost and unit. Rows can start an
  expense against that supplier.
- Mirrored to Expo: `app/(admin)/staff.tsx`, `components/finance/Suppliers.tsx`,
  `data/studio.ts`, `state/studio.tsx` (root-mounted), identity block in `content.tsx`,
  and AppShell + Luma now read the identity instead of a hard-coded name.

### Previous sync (2026-08-02T07:40Z)
- Web → mobile parity audit across all 15 modules; Finance was the only module with real
  functional gaps. New report `StudioSuite-Parity-Audit.dc.html` (printable) records the
  method, the module verdicts, the finance feature table and the open items.
- Finance gaps closed in `StudioSuite-Mobile.dc.html`: Overview now reports the desktop's
  four headline figures (income, expenses, net profit, cash at bank) plus the P&L snapshot,
  cash-movement card and Upcoming obligations (BAS, super, overdue invoices, GST threshold),
  each obligation navigating to the tab that answers it.
- Invoices gained the desktop's missing half: Raise-invoice form (client, description,
  income account, total, issue date, terms; numbering continues from INV-2001), tappable
  rows, and an ATO-format tax-invoice sheet with Record payment / Mark unpaid / Send / PDF.
  Payment state feeds cash flow, BAS and the ledger.
- Open, awaiting a decision: the public "Reserve a Date" booking flow (calendar → details →
  confirmation) has no mobile equivalent; finance persistence is in-session on mobile,
  localStorage on desktop.

### Previous sync (2026-08-02T00:00Z)
- Full end-to-end acceptance pass over the browser prototype: every control on every
  surface was read for a bound handler, clicked, and re-measured. Five dead controls were
  found and built out — gallery Download all, inbox Download, client Documents
  Preview/Download, and Order prints.
- Order prints is now a working flow (size steppers, live estimate, request lands as a
  confirmation on the Print collection); client Documents opens a real document reader
  with type-appropriate body copy.
- Tap-target floor enforced: shoot-tracker phase steps (was 36×40) now 44×44 on a
  scrolling rail, document-search Clear and Site Content Save raised to 44px.
- New gate `StudioSuite-E2E.dc.html` — single-frame crawler that walks all 19 surfaces at
  handset and desktop width, probing handler wiring, controlled inputs, thrown errors,
  tap targets, and the 12-width layout matrix in one pass.

### Previous sync (2026-08-01T08:20Z)
- Expo Finance completed to desktop parity: Expenses, GST & BAS, Reports and Accounts joined
  the existing Overview + Invoices tabs (`apps/mobile/app/(admin)/finance.tsx`), and the same
  six modules were mirrored into the browser prototype `StudioSuite-Mobile.dc.html`.
- Ported the Australian bookkeeping engine to TypeScript at `apps/mobile/src/data/finance.ts`
  (GST ÷ 11, Simpler BAS G1/1A/1B + W1/W2 + T1/5A, P&L, cash flow, 12% super guarantee,
  $20k instant asset write-off, double-entry ledger); the three bookkeeping settings are
  selectable on the Overview tab and every calculator branches off them.
- Expense edit/delete is password-gated at both ends with an append-only, hash-chained audit
  trail (`apps/mobile/src/state/finance.tsx`) — actor, device, timezone, before → after diff,
  failed attempts recorded, chain re-verified on view.
- Wide desktop tables re-laid as stacked cards for handsets; period selector (FY · quarters ·
  months) is a scrolling chip rail; all controls ≥ 44pt.
- `Invoice` in `seed.ts` gained `account` (chart-of-accounts code) and `source` so the ledger
  and P&L can post invoices without a second invoice ladder.

### Previous sync (2026-08-01T00:00Z)
- Studio-admin portal rebuilt to the design system's eight surfaces: Dashboard, Bookings, Inquiries, Shoot Tracker, Contacts, Documents, Finance, Site Content.
- Admin nav now uses the repo's icon vocabulary (sparkle · calendar · inbox · camera · users · doc · pricing · settings) with a new-inquiry count badge and the Victoria Caine identity block.
- Client-portal crossover removed from admin: the pre-shoot intake and the Luma nav entry are gone (Luma stays as the header concierge); studio admin is now permanently lights-out.
- Phones cap the tab bar at four surfaces and move the rest into a More sheet; the side rail carries all eight and scrolls.
- Expo app mirrors the same nav and screens; `apps/mobile/app/(admin)/intake.tsx` deleted.

## Screen map
| Project surface | Built from (repo) |
| --- | --- |
| StudioSuite-Mobile.dc.html · admin Dashboard | design-system/components/admin.jsx (AdminDashboard, KpiCard, UpcomingRow, Activity, ProgressLane) |
| StudioSuite-Mobile.dc.html · admin Bookings | admin.jsx (AdminBookings, FilterTab) + booking.jsx (BookingDetailDrawer); New-booking form project-authored |
| StudioSuite-Mobile.dc.html · public Reserve a Date | landing.jsx (BookingModal, BookingCalendar, Field, Legend) |
| StudioSuite-Mobile.dc.html · admin Inquiries | admin.jsx (AdminInquiries, Detail) |
| StudioSuite-Mobile.dc.html · admin Shoot Tracker | admin.jsx (AdminTracker, TrackerCard, PhaseTrack) |
| StudioSuite-Mobile.dc.html · admin Contacts | admin.jsx (AdminContacts) + data.jsx (CONTACTS_INITIAL); Add-contact form project-authored |
| StudioSuite-Mobile.dc.html · admin Studio Staff | new surface — admin.jsx (AdminContacts card grammar) + finance.jsx (register/form patterns) |
| StudioSuite-Mobile.dc.html · admin Finance → Suppliers | new tab — finance.jsx (FinExpenses register + form patterns) |
| StudioSuite-Mobile.dc.html · admin Documents | documents.jsx (AdminDocuments, TemplateLibrary) + doctemplates.jsx (26-doc pack) |
| StudioSuite-Mobile.dc.html · admin Finance | finance.jsx (FinOverview, FinInvoices) + finance-core.jsx (FIN_INVOICES_SEED, finInvoicesFromBookings) |
| StudioSuite-Mobile.dc.html · admin Site Content | admin.jsx (AdminContent, ContentBlock) |
| StudioSuite-Mobile.dc.html · admin navigation | admin.jsx (AdminSidebar, AdminNavItem) |
| StudioSuite-Mobile.dc.html · client Overview | client.jsx (HomeView, WelcomeModal) |
| StudioSuite-Mobile.dc.html · client Gallery | client.jsx (GalleryView, PhotoCard, Lightbox) |
| StudioSuite-Mobile.dc.html · client Inbox | client.jsx (InboxView, InboxRow, InboxReader) |
| StudioSuite-Mobile.dc.html · client Documents | client.jsx (DocumentsView, DocRow) |
| StudioSuite-Mobile.dc.html · Print collection | pricing.jsx (GalleryWall, PrintSize) |
| Seed data (proofs, phases, inbox, documents, contacts, inquiries) | data.jsx |
| apps/mobile/app/(admin)/finance.tsx | finance.jsx + finance-core.jsx + finance-tabs.jsx + finance-audit.jsx (all six modules) |
| apps/mobile/src/data/finance.ts | finance-core.jsx (engine, ported to TypeScript) |
| apps/mobile/src/state/finance.tsx | finance-audit.jsx (hash-chained audit log + password gate) |
| apps/mobile/app/(admin)/staff.tsx · src/data/studio.ts · src/state/studio.tsx | project-authored (no repo source) — studio identity, roster and supplier register |
| apps/mobile/src/components/finance/Suppliers.tsx | project-authored — mirrors the prototype's Suppliers tab |
| apps/mobile/app/(admin)/* | same admin/documents/finance files, mirrored to Expo React Native |
| apps/mobile/app/(client)/* | client.jsx + pricing.jsx, mirrored to Expo React Native |

## Notes
- Copy stays bound by the Image Representation & Content Policy: repo strings such as
  "edited high-resolution images" are rendered as "selected images"; the post-production
  phase reads "Curating Your Gallery".
- Mobile Finance now covers all six desktop modules in both the Expo app and the browser
  prototype (`StudioSuite-Mobile.dc.html` — reach it at `?authed=1&role=admin&route=finance`).
  Persistence now matches desktop (`localStorage`, key `studiosuite.v1`, now including the
  booking and inquiry registers); the native app would use device storage over the same key
  set. The Expo side has not yet been given the same persistence — it is still in-session,
  and it has no Reserve-a-Date screen or admin create forms yet.
- Fixed a latent prototype crash: `lumaGreeting()` runs in the constructor and read `this.INQ` /
  `this.BOOKINGS` before they were assigned, so any `?role=admin` deep link failed to render.
- The repo's `CONTACTS_INITIAL.c3` name field is corrupt upstream ("27.2k"); this project
  uses the linked booking's client, Adaeze Okonkwo.

## Sync history
- 2026-07-31 — Client portal rebuilt to the repo's module set (Inbox with in-portal
  e-signature, Documents, Print Collection wall); gallery folder model + lights-out
  frame viewer; five client surfaces; shared portal state at
  `apps/mobile/src/state/portal.tsx`.
