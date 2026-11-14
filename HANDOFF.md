# Environment and session handoff

Use this file to set up a new Claude Code cloud environment for this repository and to brief
the first session that runs in it. Part 1 is for the person creating the environment. Part 2
is the brief for the new session: paste it as the first message, or tell the session to read
this file.

State as of 14 November 2026: `main` at `dc327af`, CI green on all four jobs.

---

## Part 1 — Creating the environment

### Repository

- `devcorp-by-techcorp/potential-octo-adventure` — **public**. Everything lives here: mobile
  app, web app, backend, design tokens, gallery media Worker.
- `devcorp-by-techcorp/studio-suite_v2` — private. The source the web app and backend were
  copied from (at `5514573`). Attach only if a task needs to compare against it. Nothing should
  be copied from it into the public repo without the owner's approval.

### Network

Choose **limited** access with package registries allowed, plus these hosts:

| Host | Why |
| --- | --- |
| `api.cloudflare.com` | Wrangler deploys, R2 bucket creation, secrets, cache purge |
| `developers.cloudflare.com` | Cloudflare docs and the agent-setup prompt (blocked in the previous session) |
| `mcp.cloudflare.com` | The Cloudflare plugin's MCP server (returned 403 in the previous session) |
| `registry-1.docker.io`, `auth.docker.io`, `production.cloudflare.docker.com` | Pulling `mongo:7.0.16` for the backend tests |

The previous environment could not be changed to allow `developers.cloudflare.com`. If that
remains true, a new environment created with these hosts from the start is the way round it.
Connecting the claude.ai Cloudflare connector, or doing the deploy from your own computer, are
the alternatives.

### Secrets (environment secrets, never in the repo)

| Name | Needed for |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Wrangler in a headless session (browser login does not work in the cloud). Scope: Workers Scripts edit, Workers Routes edit, R2 edit, Zone read + Cache Purge on `illuminatestudios.com.au`. |
| `CLOUDFLARE_ACCOUNT_ID` | Wrangler. Not secret, but keep it out of git. |

`CLOUDFLARE_WORKER_SHARED_SECRET` is **not** an environment variable. It is set once with
`wrangler secret put` and in Railway's backend settings, by you, and never shown to or stored by
a session.

### Setup script (proposed — confirm it runs in the first session before saving it)

```bash
if [ -d potential-octo-adventure ]; then
  (cd potential-octo-adventure && corepack enable && pnpm install --frozen-lockfile)
  (cd potential-octo-adventure/backend && pip install -r requirements-dev.txt)
  (cd potential-octo-adventure/infra/media-worker && npm install)
fi
```

Chromium and Playwright for Node are pre-installed in cloud containers; nothing to add for the
mobile e2e suites.

---

## Part 2 — Brief for the new session

### What the project is

Illuminate Studios "Studio Suite", one pnpm workspace:

```
apps/mobile/        Expo SDK 51 / RN 0.74 / React 18 — marketing, client portal, studio admin,
                    Illuminate Kids. Seeded in-memory data; NOT connected to the backend yet.
web/                Vite + React 19 + Tailwind + shadcn/ui — public site, Luma chat, studio and
                    client portals.
backend/            FastAPI + Motor/MongoDB. Phase 3 writes need a replica set (transactions).
packages/tokens/    @is/tokens — shared design tokens (web + native).
infra/media-worker/ Cloudflare Worker serving gallery thumbnails/previews from private R2.
_ds/                Design reference. Hash-verified — do not edit (see "Open items").
docs/, goals/, test_reports/, scripts/, deploy/  Carried over from studio-suite_v2.
```

`docs/development/session-handoff.md` and `next-session-prompt.md` are **historical** v2 docs,
not this handoff.

### Working rules carried forward

- Never commit secrets. The repo is public.
- Branch from `main`, push, open a **draft** PR. Never approve or merge; the owner does that.
- `gh` GraphQL is blocked through the proxy: use `gh api repos/...` REST calls (e.g.
  `gh api repos/OWNER/REPO/pulls -X POST ...` instead of `gh pr create`).
- A Codex bot reviews PRs when they are marked ready. Verify each finding against the code,
  fix the real ones, and reply on the thread.
- Do not change Railway or `railway.toml` without flagging it to the owner first.
- Gallery/Cloudflare rules from the owner's brief: every R2 bucket stays private ("Allow Public
  Access" off); never use R2 "Connect Domain"; no `R2_BUCKET_PUBLIC` anywhere; the backend never
  streams image bytes; originals only via backend presigned URLs; do not guess account IDs or
  invent a zone — if the account or zone is not ready, stop and ask.
- Use the user's details only for attribution, never in requests to outside services.

### Commands

```bash
pnpm install --frozen-lockfile       # root; node-linker=hoisted, @types/react pinned to 18.2
pnpm build                           # tokens + web
pnpm lint:web
pnpm check:design && pnpm check:design-source

pnpm typecheck:mobile
pnpm e2e:mobile                      # web export, then finance / screens / kids / studio suites

bash backend/tests/start_mongodb.sh  # docker mongo:7.0.16 single-node replica set
cd backend && ruff check . && pytest -q

cd infra/media-worker && npm test    # Worker against in-memory R2 + cache (25 checks)
```

If dockerd is not running: `setsid nohup dockerd >/tmp/dockerd.log 2>&1 &`.
Web browser tests: `python web/tests/{gallery_theme,portal_shell,run_browser}.py`; the repo pins
Python Playwright 1.58, which may not match the container's Chromium — use a scratch venv with
the matching version rather than changing the pin.

Last known results: backend 394 passed / 2 skipped; mobile e2e finance 22, screens 125,
kids 88, studio 76; Worker 25; all four CI jobs green on `main`.

### Open items, in priority order

1. **Deploy the gallery media Worker** (`infra/media-worker`, see its README). Blocked on the
   owner confirming:
   - the `illuminatestudios.com.au` zone is active on their Cloudflare account and R2 is enabled;
   - the hostname `media.illuminatestudios.com.au`;
   - the production frontend origin for the originals bucket's CORS rule (the brief assumes
     `https://illuminatemygallery.com`);
   - the caching decision: token checked on every request, edge cache saves only the R2 read.

   Then: create the four private buckets, set the secret, deploy, seed a test object, run
   `verify.sh` (expect 200, 403×4, 404, 405, then HIT), delete the test object. A green deploy
   is not proof — the verification run is.

   One deliberate change from the owner's brief: viewers get `Cache-Control: private, no-cache`
   (browser must revalidate through the token check); the year-long immutable header stays on
   the edge copy only. Revocation and takedown steps are in the Worker README.
2. **Connect the mobile app to the backend.** It currently runs on seeded data in
   `apps/mobile/src/data` and `src/state`. Nothing has been tested on a real device.
3. **Wage cash-flow fix for the design reference.** `_ds/uploads/finance-core.jsx` counts wages
   gross. A patch is at `docs/development/patches/finance-core-wage-cashflow.patch`; it has to be
   applied in the Claude Design project, because `_ds/` is hash-verified.
4. **Owner decisions still open:** whether to remove now-public items (Railway preview hostname,
   staff-style `@illuminatestudios.com.au` addresses, seeded demo emails, test reports); whether
   to add the Claude Design handoff bundle and chat transcripts to the repo (left out so far);
   whether to install the optional `cf` CLI.

### Mobile app notes

- Expo Router groups `(admin)` and `(client)`; `usePathname()` drops group segments, so nav
  matching strips `/(group)` from hrefs (`src/components/AppShell.tsx`).
- The studio's kids page is `app/(admin)/illuminate-kids.tsx`; `app/kids/*` is the public
  Illuminate Kids flow. Keep the names distinct — they collide otherwise.
- Enquiries move through a guarded state machine (`src/data/enquiry.ts`); confirming needs a
  linked client contact and a free date, and is what creates the booking
  (`src/state/records.tsx`).
- Finance: wages are paid net of PAYG withholding (`finCashPaid` in `src/data/finance.ts`).
- RN-web does not emit `aria-checked` from `accessibilityState`; set the aria props directly.
