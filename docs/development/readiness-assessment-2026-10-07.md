# Studio Suite readiness assessment — 7 October 2026

## Verdict and scope

**Ready for further controlled development; not ready for full `_ds` acceptance or production release.** There is a substantial persistent web/backend implementation and green CI. Native parity, universal responsive evidence and several required product domains remain incomplete. A percentage would obscure those mandatory gates.

This is a source/code assessment with focused local verification and live GitHub evidence, not a new full application, native-device or provider acceptance run. No application code or `_ds` sources were changed. The accompanying [session plan](autonomous-session-plan.md) is a handoff for subsequent execution, not a claim that its orchestration or implementation phases have run.

## Verified baseline

| Item | Evidence at assessment |
| --- | --- |
| Assessed application | `11c537271958fd357f3ab9337f06bac0aa95ffee`, branch `codex/prerequisite-reconciliation-20261006`; initially clean local tree |
| Live branch | GitHub branch API returned the same `11c5372` SHA |
| Live default | `main`, `5c2fe515b0eba4b0d89492305a21f9548c2dd853` |
| PR #18 | GitHub reports merged on 6 October; merge commit `5c2fe51`. Its recorded PR head is `c8761e1`, so subsequent preview commits on the reused branch must not be assumed merged |
| Exact assessed-head CI | [Run 37443377221](https://github.com/devcorp-by-techcorp/studio-suite_v2/actions/runs/37443377221): backend, web and production-image/routing jobs all completed successfully; job steps include production-built gallery lifecycle and the real-replica-set application browser runner |
| Empirical | Connected MCP selected workspace `studio_suite_v2`; policy, recent history, todos and scar tissue retrieved. CLI DNS failed; connected MCP worked |
| Local capacity | Approximately 1.6 GiB available, 95% filesystem usage at initial inspection. This is improved from historical records but is not proof of capacity for a full database/browser/native workload |

The GitHub connector's commit-workflow wrapper returned no runs because it filters to pull-request events. The REST check-runs/jobs API established the push CI evidence above. Empty results from that wrapper do not mean CI was absent.

## Authority

Read Empirical first for context and source pointers, then verify the referenced authority and current code. Empirical summaries do not override user decisions or source documents.

1. `_ds/uploads/Studio-Suit_Project-Defintion.md`: product/design scope.
2. `_ds/uploads/Studio-Suite_Universal-Responsive-Design-Requirements.md` and `Studio-Suite_Universal-Responsive-Viewport-Matrix.md`: mandatory web/native parity, continuous geometry, all states and explicit 16 web / 21 native matrix rows.
3. `_ds/packages/tokens/src/`: extracted token authority; archives retain older reference material and component/style examples.
4. [Approved booking snapshots](../authority/booking-2026-10-05/README.md): all three policies are already approved implementation requirements. Actual configuration and genuine agreement/payment evidence remain distinct dependencies.
5. Existing grant/authentication, image-representation and Luma policies continue to apply.

Written gallery-only dark mode governs implementation under DD-01; contrary prototype examples remain a source conflict to resolve explicitly. Prototype local state, seed data, success messages, finance rates and query-string authentication are not production behavior or business authority.

## Current findings against stable DS IDs

These current findings supersede stale status sentences in the [6 October crosswalk](design-system-compliance-audit.md); that document retains the detailed source/surface inventory.

| Findings | Current assessment | Evidence / remaining completion condition |
| --- | --- | --- |
| DS-01 | Token defect repaired; local and hosted contract gates pass | `scripts/check-design.mjs`, `check-token-compatibility.mjs`; exact reference mirror, generated themes and historical exports. Does not close every C1/native requirement |
| DS-02 | Web gallery lifecycle implemented; native still contradicts ordinary-light rule | `web/src/components/landing/GalleryViewer.jsx`, `web/tests/gallery_theme.py`; `mobile/App.tsx:7` still follows OS dark mode. Retain source conflict |
| DS-03, DS-04 | Role shell and shared-control conformance incomplete | `web/src/pages/Studio.jsx:138` uses existing entry/link composition; `web/src/index.css:1151` collapses navigation at 800px instead of below 1152px. CSS includes 34px/36px controls and 2px focus rules. Actual hit areas need measurement before individual control verdicts |
| DS-05 | Mandatory full web acceptance missing | CI runs production application regressions, but `gallery_theme.py:40` has two geometry cases and existing feature tests do not enumerate all source rows, states, overlays and intermediate widths |
| DS-06, DS-07 | Native foundation defective and feature parity absent | `mobile/app.json:6` locks portrait; `mobile/App.tsx` opens two browser links and lacks protected native workflows, subscribed geometry, safe-area/keyboard and font-scale acceptance |
| DS-08, DS-09 | Public enquiry and web identity real; complete booking entry/sign-in/recovery/native journeys partial | `web/src/App.jsx`, `backend/server.py`; recovery remains unregistered/default-disabled; no approved implemented native credential exchange |
| DS-10 | Planning/resources real; scheduling and confirmation gates incomplete | `backend/bookings.py:224` deliberately returns 409 for planning → confirmed. Missing occupied intervals, holds/capacity conflict enforcement, permission/evidence integration cannot be bypassed |
| DS-11, DS-12 | Narrow progress exists; full tracker/intake/brief workflows incomplete or absent | Existing client and studio booking pages; no registered six-questionnaire/brief implementation |
| DS-13 | Public gallery real; private delivery/selections/prints absent | Public viewer does not establish private media ownership, derivatives, revocation, download/order persistence or provider acceptance |
| DS-14, DS-15 | Per-enquiry messages and canonical client roster real; complete inbox/personas/manual CRM partial | `backend/conversations.py`, `studio_contacts.py`; attachments, native journeys, manual ownership/editing and full profile tabs require bounded increments |
| DS-16 | Private versioned files real; full template/merge/signature system absent | `backend/documents.py`, `docs/manifest.json`; approved template content, restricted-role definitions and provider evidence remain dependencies |
| DS-17, DS-18 | Finance/staff/supplier product modules absent | Registered routes in `backend/server.py:129` and `web/src/App.jsx:11`; operational counts are not finance. Login identities are not a staff/contract/payroll registry |
| DS-19, DS-20 | Narrative publishing and several web assets exist; broader content/style/native coverage partial | Existing public content and fonts; global component/token use, complete logos/type/numeric/motion behavior and native bindings need measured verification |
| DS-21 | Preview infrastructure evidence exists; release acceptance remains open | Current CI green; 6 October Empirical deployment receipt `6ac4c0cd00f9510b562175e1` records preview success only. Authentication, business journeys, provider delivery, backup/restore, rollback and production authorization are separate gates |
| DS-22 | Source integrity verified; reference discovery and runtime coverage incomplete | 86 source files and 115 archive files hash/CRC verified. Broken standalone guide paths and prototype-only audit assumptions remain historical tooling limitations |

Existing backend work includes persistent sessions, explicit enquiry grants, invitations, planning/proposal revisions, transactional resource commands, messages/read state, private document versions, contacts, content and reporting. Tests exercise authorization loss, replay and concurrency. These are valuable implemented capabilities; neither a mock prototype nor the absent full target product describes the current system accurately.

## Verification performed for this assessment

| Check | Result / exact limit |
| --- | --- |
| `python3 scripts/audit-design-source.py` | PASS: 86 source files, 115 archive members; SHA-256 and CRC match |
| `node scripts/check-design.mjs` | PASS: token mirror and 25 runtime variables; repeated after rebuild |
| `node scripts/check-token-compatibility.mjs` | PASS: historical web/native palette, rollup, alpha and shadow API; repeated after rebuild |
| `pnpm build` | PASS: token JS/declarations/CSS and Vite production web build, using installed pinned pnpm and Node 22 paths |
| `pnpm lint:web` | PASS |
| `pnpm -F studio-suite-mobile typecheck` | PASS; not a native runtime test |
| `.venv/bin/ruff check backend` | PASS |
| `.venv/bin/pytest backend/tests/test_deploy_server.py backend/tests/test_health.py -ra` | 8 passed, 2 skipped because IPv6 was unavailable in the sandbox; one existing multipart deprecation warning. Health fixtures use an in-memory database |
| `.venv/bin/python backend/export_database_schemas.py --check` | PASS: 28 schemas and index/source manifest current |
| Local gallery lifecycle | Initial invocation blocked by sandbox socket `PermissionError`. Authorized socket-enabled retry PASS at 1440×1000 and 390×844/reduced motion: lifecycle, computed themes, focus/scroll, history/reload and ordinary routes. Denied API/SVG fixtures; not real identity or provider evidence |
| Exact-head hosted CI | All three jobs and relevant steps verified through live GitHub REST; historical local recovery failure remains unexplained |
| Current preview HTTP probes | First `/api/ready` attempt returned 404; a subsequent diagnostic sweep returned 200 for `/`, `/healthz`, `/api/health` and `/api/ready` (`ok:true`). The transient 404 cause is not established. Health responses do not validate authentication or business journeys |
| Full local backend/browser aggregate, native devices and real provider flows | NOT RUN for this assessment; no such pass claimed |

## Independent scrutiny and interpretation

A fresh-context reviewer independently inspected `_ds`, application code and CI, with no parent reasoning or assessment supplied. It confirmed native parity/orientation/theme gaps, navigation threshold mismatch, missing lifecycle domains, confirmation gating and incomplete matrix coverage. It independently passed the source/token checks. This was a read-only review in the shared workspace sandbox, **not an OS-isolated audit**, and cannot certify the stronger sandbox protocol proposed for subsequent phases.

The reviewer suggested a first public-entry/enquiry web/native vertical slice. The execution plan first establishes the runner isolation, fresh-context boundary and matrix harness needed to judge such a slice, then scopes native foundation/parity work separately to avoid combining multiple unverified infrastructure changes in one task.

## First execution action

Run the single **R0 bootstrap phase**: **R0-A baseline and gate reconciliation**, then **R0-B orchestration isolation and context-reset qualification**, under the [new plan](autonomous-session-plan.md). Reconcile current default/review ancestry before selecting a development branch. Do not reopen repaired token work, reuse merged PR #18, treat preview health as product acceptance, or remove the booking confirmation guard. Resolve the stale current-document pointers before automatic continuation.

## Assessment completion record

Focused runtime evidence is recorded above; [dated verification report](../../test_reports/2026-10-07-readiness-and-autonomous-plan.md) records document/review checks and Empirical receipts. Application acceptance remains unchanged by these documentation edits.
