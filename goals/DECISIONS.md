# Next-phase design and domain decisions

## Current authority update — 2026-10-06

The user makes local `_ds` the design-system source of truth. Use its extracted
token reference and written universal responsive requirements/matrix; retain
archived desktop sources and historical reports as evidence. Source inventory:
[manifest](../docs/development/design-system-source-manifest.json).
The [audit](../docs/development/design-system-compliance-audit.md) records internal
theme/source conflicts and application gaps. Existing architecture, explicit
grants and approved booking requirements remain authoritative operational contracts.
PR #12 was merged externally; use the new compliance review branch. C0–C11 in
`GOALS.md` supersede the earlier baseline/status table. Written gallery-only dark
scope remains the working rule; contrary prototype admin-dark examples remain
flagged rather than treated as approval to broaden the theme.

## DD-01 — authority and theme scope

Approved image-representation and Luma policies govern capability and copy. The TypeScript token source and canonical styles govern visual primitives; the JSON is a mirror, while prototypes are flow references only. Ordinary public and operational pages use the light semantic theme. A gallery dialog temporarily owns the dark cinematic theme, restores the prior theme on close/unmount, locks scroll and relies on modal focus containment. This resolves the reference conflict without treating prototype global-dark controls as authority.

Compatibility variables (`--font-*`, `--space-*`, `--radius-*`, `--motion-*`, and `--status-*`) are generated from the shared token source. Existing semantic variables remain canonical.

## DD-02 — planning and confirmation

**Historical decision superseded for confirmation:** the current user instruction
and `docs/development/decisions.md` require planning → confirmed to remain HTTP
409 until authoritative scheduling and obligation requirements exist. The
historical description below does not authorize confirmation.

A booking is a distinct revisioned record with one unique source enquiry. Creation is idempotent and starts in `planning`; it neither reserves capacity nor confirms availability. `planning → confirmed` is an explicit CSRF/origin-protected staff write. Because no capacity rules were approved, confirmation records staff intent but performs no collision claim. Later policy-compliant stages are preparation, shoot, selected-gallery preparation, and delivered. Cancellation can occur before delivery and can reopen only to planning.

## DD-03 — client grant coverage

**Historical withdrawal description superseded:** current withdrawal retains the
grant with `revoked_at` and audit history, as documented in
`docs/booking-operations.md`; it does not delete the grant.

An accepted enquiry grant also authorises the deliberately narrow projection of a booking whose `source_enquiry_id` matches that enquiry. Email equality never grants access. Revocation deletes only that grant, records an audit event, and makes both enquiry and linked booking disappear on the next server read. Other grants and the client identity remain intact.

## DD-04 — migration and deferred scope

No destructive migration is required. New collections and indexes are created repeatably; existing enquiry records remain immutable. Contracts referenced by `docs/manifest.json` are absent paths rather than approved contract text. Payments, contracts, CMS, native mobile, and private-media provider work remain deferred.
