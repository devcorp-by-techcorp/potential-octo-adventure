# Environment and session handoff

Use this file to set up or check the Claude Code cloud environment for this repository and to
brief a new session that runs in it. Part 1 is for the owner. Part 2 is the brief for the new
session: paste it as the first message, or tell the session to read this file.

State as of 18 November 2026: `main` at `1063c5c` (PRs #1–#9 merged). One open PR: #11, the
draft working PR for step 2. It recovered PR #10's plan corrections and assessment, which had
merged into PR #8's branch after PR #8 itself merged. The step 2 build runs on #11.

**CI on `main` was red; the fix is in PR #9.** The web job failed one check on the merge of PR
#7: `auth.js` [desktop] "double-clicking sign-in creates exactly one staff session" (staff 7 → 4,
client 2 → 0 during the check). Cause: the test-only `/__test/session-count` route counted
expired sessions too. The phone pass backdates every session (`/__test/expire-sessions`), and the
TTL index on `expires_at` deletes expired sessions on MongoDB's background sweep, every 60 s. When
a sweep landed inside the double-click window, the count fell. PR #9 counts only active sessions
(not revoked, not expired), which a sweep never removes. `main` turns green when PR #9 merges.

---

## Part 1 — The environment

### It already exists

The **`potential-octo-adventure`** cloud environment (personal, created 15 November) is set up
for this repository. Its current settings, as read on 16 November:

| Setting | Value |
| --- | --- |
| Repository | `devcorp-by-techcorp/potential-octo-adventure` (public) |
| Network | Limited, package registries and MCP servers allowed |
| Allowed hosts | `api.cloudflare.com`, `dash.cloudflare.com`, `developers.cloudflare.com`, `mcp.cloudflare.com`, `cdn.playwright.dev`, `pi.cloudflare.com`, `empirical.gauzza.com` |
| Environment variables | None set |
| Setup script | Present (saved from another session; its text cannot be read from outside that environment) |

Start new sessions for this repository in that environment, not in Default.

`pi.cloudflare.com` looks like a typo for `api.cloudflare.com`, which is also listed; it is
harmless but can be removed. `empirical.gauzza.com` is a memory connector, not a project
dependency.

### Recommended changes

1. **Environment variables** (non-secret; they save every session from setting them by hand):

   | Name | Value |
   | --- | --- |
   | `TEST_MONGODB_URI` | `mongodb://127.0.0.1:27017/?replicaSet=phase3` |
   | `BROWSER_MONGODB_URI` | `mongodb://127.0.0.1:27017/?replicaSet=phase3` |
   | `APP_TEST_PYTHON` | `backend/.venv/bin/python` |
   | `NODE_USE_ENV_PROXY` | `1` (the `cf` CLI uses Node's built-in fetch, which ignores the proxy without it) |

2. **Secrets** (environment secrets, never in the repo):

   | Name | Needed for |
   | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | Wrangler and `cf` without a browser sign-in. `cf`'s OAuth sign-in lasts about an hour and does not survive the container. Scope: Workers Scripts edit, Workers Routes edit, R2 edit, Zone read and Cache Purge on `illuminatemygallery.com.au`. |
   | `CLOUDFLARE_ACCOUNT_ID` | Wrangler and `cf`. Not secret, but keep it out of git. |

   `CLOUDFLARE_WORKER_SHARED_SECRET` is **not** an environment variable or secret here. The owner
   sets it with `wrangler secret put` and in Railway's backend settings; no session sees it.

3. **Setup script.** [`scripts/cloud-env-setup.sh`](scripts/cloud-env-setup.sh) is the tested
   reference. If you are unsure what the saved script does, replace it with this file's contents.
   It runs as root from the folder holding the checkouts, skips cleanly when the repository is
   not attached, and is safe to re-run. It:
   1. pins pnpm 10.34.3 through corepack, runs `pnpm install --frozen-lockfile`, builds `@is/tokens`;
   2. creates `backend/.venv` (gitignored) with the backend's dev requirements;
   3. downloads the Chromium build for Playwright 1.58 (needs `cdn.playwright.dev`);
   4. installs Wrangler 4.156.0 and `cf` 1.0.0-beta.26 globally;
   5. pre-pulls `mongo:7.0.16`, starting `dockerd` only for the pull and stopping it again.

   Tested on 16 November against `main` at `f5474d1`, from the checkouts folder: a re-run took
   21 s; Wrangler, `cf`, the MongoDB pull and the workspace install all worked, and no daemon was
   left running. Step 3 failed in the test container only because it does not allow
   `cdn.playwright.dev`; the `potential-octo-adventure` environment does.

   `cf` is pinned to beta.26, the newest release at least two weeks old. The other session's
   notes say the saved script installs beta.32 (released 13 November). Either works.

**Why `cdn.playwright.dev` is required, not optional:** Playwright 1.58 is pinned for the Python
web suites *and*, since PR #7, for the mobile e2e suites. The container's pre-installed Chromium
is a different build (1243, against the 1208 that 1.58 needs), so without that host neither
browser suite can launch.

---

## Part 2 — Brief for the new session

### Read first

1. This file.
2. `docs/development/app-work-plan.md` — the current plan for the Expo app. It is the source of
   truth for what comes next and for the process the owner expects.
3. `docs/app-local-development.md` — running the app against a local backend.

`docs/development/session-handoff.md` and `next-session-prompt.md` are **historical** v2 docs.

### What the project is

Illuminate Studios "Studio Suite", one pnpm workspace:

```
apps/mobile/        Expo SDK 51 / RN 0.74 / React 18. Becomes the single studio and client
                    app on desktop web, iOS and Android. Sign-in, sessions and route guards run
                    against the real backend (step 1, PR #7). Every business screen still uses
                    seeded in-memory data until its own step.
web/                Vite + React 19 + Tailwind + shadcn/ui. Public site and Luma stay here; its
                    studio and client portals retire once the Expo app matches them.
backend/            FastAPI + Motor/MongoDB. Cookie sessions for browsers, bearer sessions for
                    native. Phase 3 writes need a replica set (transactions).
packages/tokens/    @is/tokens — shared design tokens (web + native).
infra/media-worker/ Cloudflare Worker serving gallery thumbnails/previews from private R2,
                    on media.illuminatemygallery.com.au. Not deployed.
_ds/                Design reference. Hash-verified — do not edit.
docs/superpowers/   Specs and plans, one pair per app step.
docs/, goals/, test_reports/, scripts/, deploy/  Carried over from studio-suite_v2.
```

### Owner decisions to respect

The full table is in the app work plan. The ones most likely to matter:

- **Domains:** `illuminatestudios.com.au` is the primary company domain (website and app entry;
  DNS stays at VentraIP). `illuminatemygallery.com.au` holds gallery services and direct client
  portal access, and is active on Cloudflare.
- **Hybrid sign-in:** browsers use the existing cookie sessions unchanged; native uses bearer
  tokens in SecureStore. A request carrying both a session cookie and an `Authorization` header
  is refused, so never put HTTP Basic auth in front of the app.
- **Booking confirmation follows the backend:** confirming an enquiry creates a *planning*
  booking; planning → confirmed stays HTTP 409 until scheduling, authority and agreement/payment
  checks exist.
- **No partial releases:** nothing ships until every page and service works on real data and is
  tested.
- **Process per step:** design agreed with the owner (`docs/superpowers/specs/`), then a plan
  (`docs/superpowers/plans/`), built task by task with independent review, then a final
  whole-branch review and a draft PR.
- **Cloudflare tooling:** `cf` CLI, except `infra/media-worker`, which keeps Wrangler.

### Working rules

- Never commit secrets. The repo is public.
- Branch from `main`, push, open a **draft** PR. Never approve or merge; the owner does that.
- `gh` GraphQL is blocked through the proxy: use `gh api repos/...` REST calls (e.g.
  `gh api repos/OWNER/REPO/pulls -X POST ...` instead of `gh pr create`).
- A Codex bot reviews PRs when they are marked ready. Verify each finding against the code,
  fix the real ones, and reply on the thread.
- Do not change Railway or `railway.toml` without flagging it to the owner first.
- Gallery/Cloudflare rules from the owner's brief: every R2 bucket stays private ("Allow Public
  Access" off); never use R2 "Connect Domain"; no `R2_BUCKET_PUBLIC` anywhere; the backend never
  streams image bytes; originals only via backend presigned URLs; never guess account IDs or
  invent a zone.
- `ruff check` enforces a 100-character line limit. Do not run `ruff format` across the repo; it
  rewrites unrelated files.
- Use the user's details only for attribution, never in requests to outside services.

### Commands

Docker is not running when a session starts, and a restart of the session's worker process stops
it again. Start it, then the replica set:

```bash
(dockerd >/tmp/dockerd.log 2>&1 &); until docker info >/dev/null 2>&1; do sleep 1; done
bash backend/tests/start_mongodb.sh   # mongo:7.0.16, replica set "phase3", port 27017
```

Then (the `*_MONGODB_URI` and `APP_TEST_PYTHON` values are needed unless set on the environment):

```bash
pnpm install --frozen-lockfile        # root; node-linker=hoisted, @types/react pinned to 18.2
pnpm build                            # tokens + web
pnpm lint:web
pnpm check:design && pnpm check:design-source

cd backend && .venv/bin/ruff check . \
  && TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' .venv/bin/pytest -q
cd backend && .venv/bin/python export_database_schemas.py --check

pnpm typecheck:mobile
BROWSER_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' \
  APP_TEST_PYTHON=backend/.venv/bin/python pnpm e2e:mobile
#   builds the web export with EXPO_PUBLIC_* blanked, runs finance / api-client / session-state,
#   then starts backend/tests/app_server.py and runs auth / screens / kids / studio against it.
#   One suite only: node apps/mobile/e2e/run.js auth   (after a build)

python web/tests/{gallery_theme,portal_shell,run_browser}.py   # web browser suites (venv Python)
cd infra/media-worker && npm test     # Worker against in-memory R2 + cache
```

Without `TEST_MONGODB_URI`, Phase 3 backend tests fail with "temporarily unavailable". The
screens suite reports "N clean, M with findings", not "N passed".

Last known results (PR #7's report, commit `36f1bda`): backend 426 passed / 2 skipped; schemas
current (28 collections); mobile e2e 427 checks — finance 22, api-client 42, session-state 18,
auth 56, screens 125 clean, kids 88, studio 76; Worker 25 (re-run 16 November on `main`).

### Open items, in priority order

1. **Fold in the sign-out fix from the Codex review of PR #7.** `AppShell.tsx` `leave` (side rail
   and More sheet) must await `signOut()` before navigating, and sign-in must be refused while a
   sign-out is pending. Details on the Codex thread on PR #7. Add a browser check.
2. **Step 2 of the app plan: enquiries, bookings and contacts.** Design it with the owner first,
   then plan and build it, on endpoints that already exist. Before its screens make
   authenticated calls, close the step-1 items the work plan lists (browser test of the
   in-session 401 redirect, bearer write tests through the `public_content` and `booking_drafts`
   fences, a shared response model for the two token endpoints).
3. **Deploy the gallery media Worker** (`infra/media-worker`; steps in its README). Done: the
   `illuminatemygallery.com.au` zone is active on the owner's Cloudflare account; the Worker is
   configured for `media.illuminatemygallery.com.au`; the originals bucket's CORS origin is
   `https://illuminatemygallery.com.au`; the caching decision is made (token checked on every
   request, edge cache saves only the R2 read). Remaining: create the four private buckets, the
   owner sets `CLOUDFLARE_WORKER_SHARED_SECRET`, deploy, seed a test object, run `verify.sh`
   (expect 200, 403×4, 404, 405, then HIT), delete the test object. A green deploy is not proof;
   the verification run is.

   One deliberate change from the owner's brief: viewers get `Cache-Control: private, no-cache`
   (browser must revalidate through the token check); the year-long immutable header stays on the
   edge copy only. Revocation and takedown steps are in the Worker README.
4. **Native verification has never been run.** No simulator or device is available in the cloud.
   The manual checklist in `test_reports/2026-11-15-app-foundation.md`, including the
   corrupt-stored-session step, must pass on a real device or simulator before any native release.
5. **Owner decisions still open:** whether to remove now-public items (Railway preview hostname,
   staff-style `@illuminatestudios.com.au` addresses, seeded demo emails, test reports); whether
   to add the Claude Design handoff bundle and chat transcripts to the repo; whether to keep
   Prints in the client portal's phone "More" menu; the wage cash-flow patch
   (`docs/development/patches/finance-core-wage-cashflow.patch`), which has to be applied in the
   Claude Design project because `_ds/` is hash-verified.

The work plan also lists smaller step-1 follow-ups (client-facing staff wording in the phone
"More" menu, FastAPI 422 messages, test-harness robustness, `WWW-Authenticate` on bearer 401s).

### Mobile app notes

- Expo Router groups `(admin)` and `(client)`; `usePathname()` drops group segments, so nav
  matching strips `/(group)` from hrefs (`src/components/AppShell.tsx`).
- The studio's kids page is `app/(admin)/illuminate-kids.tsx`; `app/kids/*` is the public
  Illuminate Kids flow. Keep the names distinct — they collide otherwise.
- API access goes through one client (`src/api/client.ts`); sessions live in
  `src/state/session.tsx` with a pure reducer in `sessionReducer.ts`; `SessionGate` guards routes.
  Web stores no token (cookie sessions); native keeps the bearer token in SecureStore
  (`credentials.native.ts`).
- `EXPO_PUBLIC_*` values are inlined at build time; `apps/mobile/.env.example` documents
  `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL`. Never put secrets there.
- Enquiries move through a guarded state machine (`src/data/enquiry.ts`); in the seeded data,
  confirming needs a linked client contact and a free date (`src/state/records.tsx`). Step 2
  replaces this with the backend's enquiry operations.
- Finance: wages are paid net of PAYG withholding (`finCashPaid` in `src/data/finance.ts`).
- RN-web does not emit `aria-checked` from `accessibilityState`; set the aria props directly.
