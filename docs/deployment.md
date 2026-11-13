# Railway deployment

Run `backend` and `web` in the same Railway project/environment, backed by
MongoDB Atlas or an existing managed MongoDB. Caddy serves the built frontend
and proxies `/api` over private networking. The browser sees one HTTPS origin,
so staff cookies work on a Railway-generated domain without third-party cookies.
Railway terminates public TLS; Caddy listens on the injected `PORT`.

## Service settings

### Preview target prepared on 2026-10-06

Read-only Railway API inspection verified project `triumphant-freedom`
(`5e6a20db-f850-4ca9-9732-7764997cf0c0`), environment `preview`
(`908f025f-ecb8-49ea-ae70-169cd445e986`), web service `studio-suite_v2`
(`0cd586b2-40ff-4f92-9fbc-48633b2686da`) and API service `backend`
(`47a4db1b-5649-4772-b05c-2667251ef6e8`). Web origin:
`https://studio-suitev2-preview.up.railway.app`.

[preview.json](../deploy/railway/preview.json) records the preview dashboard/API
settings. Railway rejected selection of legacy TOML files during the authorized
release: new Config as Code enrolment is deprecated. Equivalent settings were
applied directly to preview through `serviceInstanceUpdate`; the existing TOML
files remain reference copies and are not selected by these services.
Railway's API builder enum is `RAILPACK`; setting `dockerfilePath` to
`web/Dockerfile` makes Railway use Dockerfile detection for the web build.
[Migration guidance](https://docs.railway.com/infrastructure-as-code#migrating-from-config-as-code).

The preview variable templates contain no credentials:
[backend](../deploy/railway/backend.env.example) and
[web](../deploy/railway/web.env.example). Non-secret preview values were applied;
database credentials and live Luma credentials must be set privately in Railway.
The user subsequently configured a MongoDB URI and selected `studio_suite` as
`MONGODB_DB_NAME`. A malformed `OPE$NAI_API_KEY` variable caused Railpack to fail
with `secret OPE not found`; its value was moved privately to `OPENAI_API_KEY`
and the malformed variable removed. Variable names must be valid environment
identifiers. No production variables are copied automatically.

The old web pnpm/`npx serve`/cache-removal command overrides are cleared by the
recorded API settings (empty strings for build/start, an empty array for
pre-deploy; null updates leave old commands intact). Caddy starts through the
Docker image CMD. The backend
root is `/backend`, with explicit start/read-only pre-deploy/readiness settings.
The existing derivative worker is outside this release and remains unchanged.

The application is not established as fully compliant or deployment-ready; see
the [compliance assessment](development/design-system-compliance-audit.md) and
[acceptance goals](../goals/GOALS.md). Select an accepted, verified commit for a
future deployment; production deployment still requires separate authorization.
The authoritative `_ds` reference is retained in Git and excluded from Docker
context. Its prototype services/assets must not become production entry points.

| Setting | backend | web |
| --- | --- | --- |
| Repository | `devcorp-by-techcorp/studio-suite_v2` | same |
| Root Directory | `/backend` | `/` |
| Preview config authority | Dashboard/API settings in `preview.json` | same |
| Builder | Railpack, Python 3.11 | Dockerfile `web/Dockerfile` |
| Health check | `/api/ready` | `/healthz` |
| Public domain | Not needed; keep private | Generate HTTPS domain or attach custom domain |

For legacy enrolled services, config-file paths are relative to the repository, not the service root. Remove
old dashboard build/start/pre-deploy overrides, including the old `npx serve`
command. The web root must include `packages/tokens`, so never set it to `/web`.
The Docker build installs pinned pnpm 10.34.3, builds tokens before Vite, and
copies the bundle into Caddy. Startup does not download npm packages.

## Variables

Generate the web domain first. Set these in Railway; never commit secrets or
overwrite working values by importing the empty environment templates.

| Service | Variable | Value |
| --- | --- | --- |
| backend | `ENVIRONMENT` | `production` |
| backend | `PORT` | `8000` |
| backend | `MONGODB_URI` | Managed MongoDB driver URI; percent-encode credentials |
| backend | `MONGODB_DB_NAME` | Intended production database |
| backend | `AUTH_ALLOWED_ORIGINS` | Exact web HTTPS origin, without a path |
| backend | `CORS_ORIGINS` | Same exact web HTTPS origin |
| backend | `OPENAI_API_KEY` | Required for Luma; server only |
| backend | `OPENAI_MODEL` | Optional; default `gpt-4.1-mini` |
| web | `PORT` | `8080` |
| web | `API_UPSTREAM` | `http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}` |
| web | `VITE_BACKEND_URL` | Unset/empty for same-origin routing |

Adjust the `backend` reference if the Railway service has another name. The API
uses `python deploy_server.py` to bind one explicit dual-stack socket for IPv4
health checks and IPv6/IPv4 private networking. The bare Uvicorn `--host ::`
startup path accepts IPv6 only and failed Railway health checks even after
MongoDB/schema checks passed. Match the upstream
port to backend `PORT`. Private DNS resolves at runtime, not during image build.
`API_UPSTREAM` is required to start Caddy and must not contain credentials.
Never put private DNS names or secrets in VITE variables: those reach browsers.

Optional backend settings: `AUTH_SESSION_SECONDS` (default 28800), and all three
of `RESEND_API_KEY`, `BOOKING_NOTIFICATION_EMAIL`, `BOOKING_FROM_EMAIL` to enable
alerts with a verified sender. Enquiries persist even without email. Leave
`CORS_ORIGIN_REGEX` unset. Client authentication and enquiry invitations are implemented.
Private document storage has an opt-in R2 adapter: leave
`DOCUMENT_STORAGE_BACKEND=disabled` until its private bucket and credentials are
configured. Local storage is rejected in production mode. Client recovery is
an unregistered candidate and is outside this launch.
Client invitation writes require a transaction-capable MongoDB replica set
(or Atlas cluster); standalone MongoDB is unsupported. Configure Atlas network access for the backend's actual egress
addresses, application read/write/index permissions, and production backups.

## Launch

1. Configure both services. Preview still needs `ENVIRONMENT=production` for
   Secure cookies and HTTPS origin validation. Select an isolated preview
   MongoDB database; never use a production database for destructive tests.
   In a trusted backend operator shell, run `python initialize_database.py --check`.
   If provisioning is needed, review the default read-only plan and explicitly
   run `--apply` under the database operator's authorization. Automatic backend
   deployment runs only the read-only `--check` gate, verifying required
   collections/indexes without provisioning or deleting data. Separately verify
   Atlas/replica-set topology; this read-only schema check does not test transactions.
2. Deploy backend. `/api/ready` returns 503 until
   MongoDB answers, preventing a disconnected new deployment from passing the
   release check. `/api/health` remains process liveness. Readiness tests DB
   connectivity only, not index permissions or provider availability.
3. Deploy web and check both `/healthz` and `/api/ready` through its public domain.
   Web liveness is deliberately independent of backend deployment order.
4. In an interactive backend operator shell, or a trusted local backend Python
   environment configured for the intended production database, provision staff:

   ```bash
   python staff.py provision staff@example.com --name "Studio Staff"
   ```

   Use the hidden password prompt, never command arguments. See the
   [staff recovery guide](studio-authentication.md) for reset and disable actions.
5. Sign in at `/studio`, reload `/studio/home`, open the inbox, and sign out.
   Confirm `__Host-studio_session` is HttpOnly, Secure and SameSite=Lax; verify
   protected API requests return 401 after logout.
6. Issue an invitation for an isolated test enquiry, accept it as a test client,
   reload the client enquiry page, verify cross-account denial and client logout.
   Use a trusted manual channel; issuing an invitation sends no email.
7. Submit a labelled test enquiry and confirm persistence in the staff inbox,
   optional email delivery and Luma's live provider response. Enquiries remain
   pending studio confirmation and must not be presented as confirmed bookings.

```bash
curl --fail https://YOUR-WEB-DOMAIN/healthz
curl --fail https://YOUR-WEB-DOMAIN/api/ready
curl --fail https://YOUR-WEB-DOMAIN/studio
```

The readiness response must be 200 with `{"ok":true}`. A successful SPA page
alone does not prove authentication or database readiness.

## Proxy trust

The default does not trust arbitrary forwarded client-IP headers. Users may
share the proxy IP login budget of 20 attempts per 15 minutes; per-email limits
remain separate. Before broader staff rollout, verify the actual Railway
ingress chain and configure Caddy trusted proxies and Uvicorn
`FORWARDED_ALLOW_IPS` for only those verified addresses/networks. Never use
wildcard trust on a publicly reachable API. Test distinct client IPs and spoofed
forwarding headers before considering that configuration verified. Do not log
auth bodies, cookies or CSRF headers; Caddy access logging is not enabled here.

For deliberately separate public API/web hosts, follow the same-site custom
domain rules in the authentication guide and rebuild with the public
`VITE_BACKEND_URL` Docker build argument. The default needs no public API domain.

## Verification and rollback

PR CI retains real-MongoDB backend/browser regressions and adds the production
Docker build and proxy smoke test. This checks SPA deep links, real assets,
missing-asset 404s, API paths/query strings, cookies, Origin/CSRF headers and
upstream 503 propagation against an isolated fake upstream. It does not verify
live Railway TLS, private networking or external providers.

```bash
docker build -f web/Dockerfile -t studio-suite-web:test .
python web/tests/production_server.py --image studio-suite-web:test
```

The Docker smoke runner uses Linux host networking, as in CI. For a local build
without Docker, use pinned pnpm and Caddy 2.10.2:

```bash
pnpm install --frozen-lockfile
pnpm build
CADDY_BINARY=/path/to/caddy python web/tests/production_server.py
```

Record the deployed commit and variable configuration. If rollout fails,
redeploy the last known good Railway deployment and restore changed origins or
upstream variables. These changes add no data migration; keep database data
intact. If returning to the old static-only web service, roll web/backend back
as a compatible pair, then repeat readiness and sign-in checks. Deploy checks
are not continuous monitoring: monitor public `/api/ready` and provider errors.

Documentation checked through Context7:
[Railway monorepos](https://docs.railway.com/deployments/monorepo),
[Dockerfiles](https://docs.railway.com/builds/dockerfiles), and
[Caddy SPA routing](https://caddyserver.com/docs/caddyfile/patterns#single-page-apps-spas).
