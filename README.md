# Studio Suite

Current execution: [R0 preparatory evidence](test_reports/2026-10-08-r0-bootstrap.md); the existing review host passed independent qualification. R0 remains non-GREEN pending the complete supervisor/gate scope audit and its remaining full-phase gates.

Monorepo for the Studio Suite platform: a public, no-auth marketing front-end that
is the entry point to an auth-gated studio admin portal and individual auth-gated
client portals, backed by a FastAPI service and (in a later task) a high-resolution
burst-access media pipeline (Cloudflare R2 + Worker/CDN).

The public entry page now includes the Illuminate Studios landing UI, a gallery
reel and photo viewer, collection enquiries, and Luma, a server-side OpenAI booking
assistant. Enquiries are persisted in MongoDB and remain pending studio
confirmation. Optional Resend notifications alert the studio to new enquiries.
Authenticated staff can convert an enquiry into one idempotent planning
booking and advance permitted revisioned workflow stages. Planning-to-confirmed
remains HTTP 409 until approved scheduling, authority and agreement/payment
evidence checks are implemented and verified. Accepted
client grants expose only narrow linked progress and can be revoked individually.
See [booking operations](docs/booking-operations.md) for the lifecycle contract.

See [entry-page setup and behaviour](docs/entry-page.md) for configuration,
verification, and the distinction between enquiries and confirmed bookings.
Staff authentication is available at `/studio`, with a protected studio home,
persistent sessions and operator-managed access. See
[staff setup, recovery and deployment](docs/studio-authentication.md).
The persistent [studio enquiry inbox](docs/studio-enquiry-inbox.md) now supports
shared staff triage and private notes. Staff can now issue manual
[client invitations](docs/client-invitations.md) for authenticated, read-only
access to a specific enquiry at `/client`. Enquiries remain pending studio
confirmation; creating a planning record does not confirm or reserve time. Payments
and private media remain future milestones.
Phase 3 writes require a MongoDB replica set supporting transactions.

The local [`_ds/`](_ds/) directory is the design-system source of truth. The
[compliance assessment](docs/development/design-system-compliance-audit.md) and
[goal ledger](goals/GOALS.md) describe confirmed gaps and required web/native
acceptance. The application is not yet established as fully compliant or ready
for production deployment. `pnpm check:design-source` verifies source hashes and
archive CRCs; current token mirror/API checks pass. Full design compliance remains
open. Use the [7 October readiness assessment](docs/development/readiness-assessment-2026-10-07.md),
[autonomous execution plan](docs/development/long-running-session-plan.md) and
[controller prompt](docs/development/next-session-prompt.md) for the current handoff.

## Layout

```
backend/        FastAPI + async MongoDB (Motor) service. Health probes, settings, tests.
web/            Vite + React 19 + Tailwind + shadcn/ui. Illuminate landing, gallery reel, Luma chat, enquiry form.
apps/mobile/    Expo (React Native) app: marketing, client portal, studio admin and Illuminate Kids.
                Runs on seeded in-memory data; it is not yet connected to the backend.
packages/tokens/ @is/tokens — shared design tokens for web and native.
_ds/            Authoritative local design reference, archives and requirements.
.github/        CI: backend and web gates plus real-MongoDB public/studio browser regressions on PRs.
test_reports/   Per-task completion reports with gate evidence.
```

The web app, backend, docs and tooling were brought in from the `studio-suite_v2`
repository. Its browser-launch mobile shell was not carried over: `apps/mobile`
replaces it. See [apps/mobile/README.md](apps/mobile/README.md) for the mobile app.

Each deployable part (`backend/`, `web/`) carries its own `railway.toml` and its own
`.env.example`. Real secrets live only in gitignored `.env` files — never in git.

## Stack

- **Backend:** Python 3.11, FastAPI, Uvicorn, Motor (async MongoDB driver),
  pydantic-settings. Metadata-only persistence in MongoDB Atlas.
- **Web:** Vite, React 19, Tailwind CSS (locally built), shadcn/ui, ESLint.
- **Hosting:** Railway (one service per deployable directory).
- **Storage (reserved):** Cloudflare R2 private buckets — settings fields are
  reserved by name in this task; the adapter is implemented later.

## Run the backend (local)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt          # prod + dev tooling
cp .env.example .env                          # then fill in MONGODB_URI / MONGODB_DB_NAME
uvicorn server:app --reload --port 8000
# Liveness:  curl http://127.0.0.1:8000/api/health
# DB probe:  curl http://127.0.0.1:8000/api/health/db
```

Quality gates:

```bash
cd backend
ruff check .
pytest -q
```

The `GET /api/health/db` probe reports MongoDB connectivity as a status object and
does **not** crash the service when the database is unreachable.

Before serving a new database, run `python initialize_database.py --apply` from
`backend` with the intended MongoDB environment. See
[database initialization](docs/database-initialization.md) for the collection/index
contract, read-only preview and repeatable verification commands.
The [collection schema directory](backend/schemas/README.md) documents all 28
collections, their BSON field types, lifecycle fields and indexes.

## Run the web app (local)

Install from the repository root using the pinned pnpm version:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:web                       # builds shared tokens, then starts Vite
```

Run the backend on port 8000 in a second terminal. Vite proxies `/api` locally.
For a separately hosted backend, copy `web/.env.example` to `web/.env` and set
`VITE_BACKEND_URL` to the backend origin. Never put an OpenAI key in a Vite variable.

```bash
pnpm build                         # tokens followed by web; outputs web/build/
pnpm lint:web                      # ESLint
pnpm -F studio-suite-web preview    # preview the production bundle
```

The production preview does not use the development API proxy; configure
`VITE_BACKEND_URL` before building when using a separate backend origin.

## Run the mobile app (local)

```bash
pnpm install --frozen-lockfile
pnpm mobile                        # Expo dev server
pnpm typecheck:mobile
pnpm e2e:mobile                    # needs Playwright + Chromium available to Node
```

The workspace uses a flat `node_modules` (`node-linker=hoisted` in `.npmrc`), which the
React Native toolchain expects. React 18 serves the mobile app and React 19 the web app.

## Deployment

Follow the [Railway deployment guide](docs/deployment.md) for exact service roots,
config paths, variables, staff provisioning, launch checks and rollback.
The backend uses `/backend`; the web Docker build uses the repository root and
builds `@is/tokens` before Vite. Caddy serves `web/build/` and reverse-proxies
`/api` to the private backend, enabling staff authentication on one HTTPS origin.
Backend deployments use `/api/ready` (200 when MongoDB responds, otherwise 503);
`/api/health` remains liveness. The web process uses `/healthz` for liveness.

> `backend/railway.toml`, `web/railway.toml`, and `.github/workflows/ci.yml` are
> **infrastructure** files — review them as infra, not as ordinary application code.
