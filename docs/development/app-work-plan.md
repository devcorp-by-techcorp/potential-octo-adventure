# Studio Suite app work plan

State as of 18 November 2026.

Read this first in any session that continues the work on the Expo application. It is the
current plan; `session-handoff.md` and `next-session-prompt.md` in this folder are historical
documents carried over from studio-suite_v2.

## Goal and the bar for done

The Expo application in `apps/mobile` becomes the single studio and client application:
- **Desktop web:** the primary way the studio runs its business, and also used by clients who
  prefer a desktop, such as childcare centre managers.
- **Native iOS and Android:** for studio staff in the field, and for anyone without a desktop.

Nothing is released until every page, feature, function and service works against real data and
has been tested. Partial releases are not wanted.

The Vite app in `web/` keeps the public marketing site and Luma. Its studio and client portals
keep running until the Expo app matches them, and are then retired.

## Owner decisions already made

| Decision | Detail |
| --- | --- |
| One application | `apps/mobile` (Expo) serves desktop web and native. |
| Hybrid sign-in | The browser uses the existing cookie sessions. The native app uses bearer tokens kept in SecureStore. Both share the same session records. |
| Booking confirmation follows the backend | Confirming an enquiry creates a planning booking. Planning → confirmed stays refused (HTTP 409) until the scheduling, authority and agreement/payment evidence checks exist. |
| Domains | `illuminatestudios.com.au` is the primary domain, entry to the website and application, and stays at VentraIP DNS. `illuminatemygallery.com.au` holds gallery services and direct client portal access, and is active on Cloudflare. |
| Native session lifetime | 8 hours, the same as the web (`AUTH_SESSION_SECONDS`). A longer lifetime or a biometric unlock can come later. |
| Password reset and invitation acceptance | These stay on the web flow; the app links out to them. Studio staff resets go through the operator (`backend/staff.py`). |
| Portal switching on web | A browser holding both studio and client sessions reopens as the role last used. Sign-out signs out of both. |
| Gallery media caching | Every media request is checked against its access token. The edge cache saves only the R2 read. |
| Cloudflare tooling | Use the `cf` CLI, except where a Wrangler config exists (`infra/media-worker` keeps Wrangler). |

## The plan

| Step | Scope | Status |
| --- | --- | --- |
| 1. Foundation | API client, hybrid sign-in, sessions that survive restarts, route guards, browser tests against a real backend | **Merged** in [PR #7](https://github.com/devcorp-by-techcorp/potential-octo-adventure/pull/7); the sign-out follow-up merged in PR #8. Native is not yet run on a device. |
| 2. Enquiries, bookings and contacts | Public enquiry form, inquiry triage, bookings, shoot tracker, contacts and dashboard, all on endpoints that already exist | **In progress** in draft PR #11 |
| 3. Content, documents and client portal home | The backend partly supports these | Planned |
| 4. New backend services | Inbox and e-signature, finance (invoices, expenses, GST/BAS, audit trail), Illuminate Kids, staff management | Planned |
| 5. Galleries and prints | Depends on the media Worker being deployed | Planned |

Each step follows the same process:
1. A design is agreed with the owner, and the doc goes in `docs/superpowers/specs/`.
2. An implementation plan goes in `docs/superpowers/plans/`.
3. The plan is built task by task: a fresh agent builds each task, and an independent reviewer
   checks it before the next starts.
4. A final whole-branch review, then a draft PR.

The owner chose this process for step 1 and expects it to continue.

## Next session: where to start

Done since 16 November:
- the sign-out fix from the Codex review of PR #7 (PR #8, with browser and unit checks);
- the step 2 design, approved by the owner on 18 November;
- the step 2 plan, reviewed against the backend on 18 November
  (`docs/development/assessment-2026-11-18.md`).

- the owner approved the amended plan and started the build on 18 November, in draft PR #11.

Next: **continue the step 2 build** in PR #11, task by task
(`docs/superpowers/plans/2026-11-18-enquiries-bookings-contacts.md`). The ticked boxes in
PR #11's description show progress. Each task gets an independent review before the next starts.

## Open items from step 1

The final review triaged these as safe to wait.

- **Before step 2 screens make authenticated calls:**
  - a browser test of the in-session 401 redirect;
  - bearer write tests through the `public_content` and `booking_drafts` fences;
  - a shared response model for the two token endpoints.
- **The phone "More" menu shown to clients uses staff wording:** the manager name, the "Studio
  Manager" fallback, and the "More studio surfaces" label. The compact-web client view has no
  account menu.
- **FastAPI 422 list errors** fall back to a generic message instead of showing the validation
  text.
- **Test harness robustness:**
  - `run.js` resolves a bare `APP_TEST_PYTHON` command as a path, and uses SIGKILL teardown;
  - `serve.js` has no request error handling;
  - the suites rely on fixed `waitForTimeout` values.
- **Small items:**
  - no `WWW-Authenticate: Bearer` header on bearer 401s;
  - the dev seed can't repair a half-finished earlier run;
  - a test-fixture import tidy-up in `test_bearer_sessions.py`.
- **Native verification has never been run.** The manual checklist in
  `test_reports/2026-11-15-app-foundation.md`, including the corrupt-saved-login step, must pass on
  a real device or simulator before any native release.

## Gallery media Worker (`infra/media-worker`)

- **Done:**
  - the zone `illuminatemygallery.com.au` is active on the SKYNET Cloudflare account;
  - the Worker is configured for `media.illuminatemygallery.com.au`;
  - the originals bucket's CORS origin is `https://illuminatemygallery.com.au`.
- **Remaining:** create the four private R2 buckets, have the owner set
  `CLOUDFLARE_WORKER_SHARED_SECRET`, deploy, seed a test object, run `verify.sh`, and delete the
  test object. The Worker README has the steps. A green deploy is not proof; the verification run
  is.

## Open owner decisions

- Whether to remove now-public items: the Railway preview hostname, staff-style
  `@illuminatestudios.com.au` addresses, seeded demo emails and test reports.
- Whether to add the Claude Design handoff bundle and chat transcripts to the repository.
- Whether to keep Prints in the client portal's phone "More" menu (moved there so phone clients
  can reach sign-out).
- The wage cash-flow patch (`docs/development/patches/finance-core-wage-cashflow.patch`) has to
  be applied in the Claude Design project, because `_ds/` is hash-verified.

## Environment notes for cloud sessions

- **Setup script:** the environment's setup script installs the pnpm workspace, `backend/.venv`,
  Python Playwright Chromium, Wrangler 4.156.0 and `cf` 1.0.0-beta.32. It also pre-pulls
  `mongo:7.0.16`.
- **Docker isn't running when a session starts.** Start it, then the replica set:
  `(dockerd >/tmp/dockerd.log 2>&1 &)` then `bash backend/tests/start_mongodb.sh`. Backend tests
  need `TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3'`, because Phase 3 writes
  need transactions; without it they fail with "temporarily unavailable".
- **App browser tests:**
  `BROWSER_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' APP_TEST_PYTHON=backend/.venv/bin/python pnpm e2e:mobile`.
  The screens suite reports "N clean, M with findings", not "N passed".
- **`cf` needs `NODE_USE_ENV_PROXY=1`** in the cloud container, because Node's built-in fetch
  ignores the proxy. Its OAuth sign-in lasts about an hour and doesn't survive the container. For
  lasting access, save a scoped `CLOUDFLARE_API_TOKEN` as an environment secret.
- **Restarts:** a restart of the session's worker process stops `dockerd`. Start it again.
- **Ruff:** `ruff check` enforces a 100-character line limit. Don't run `ruff format` across the
  repo, because it rewrites unrelated files.
