# Deployment preparation — 3 October 2026 (Australia/Melbourne)

Base: `27d71e49fe65be433153a203bbb8b5e29ce8055e`, repository default branch
`claude/illuminate-gallery-rebuild-deploy-dy6bie`.

## Changes

- Added a multi-stage Node 22/pnpm 10.34.3 web build and Caddy 2.10.2 runtime.
- Replaced startup-time `npx serve` with same-origin `/api` reverse proxy,
  SPA fallback, explicit missing-asset 404s and `/healthz` liveness.
- Added redacted `/api/ready` responses (200/503) and selected that endpoint
  for Railway backend deployment health. Enabled private IPv6 listening.
- Added readiness regressions and a production routing smoke test; CI builds
  and tests the actual Docker image and retains existing MongoDB/browser gates.
- Documented service roots/config paths, variables, provisioning, live checks,
  proxy-IP trust limitations and rollback in `docs/deployment.md`.

## Verification performed

- Frozen workspace install using pnpm 10.34.3: passed.
- Tokens build and Vite production build: passed (1,649 modules transformed).
- Frontend ESLint and backend Ruff: passed.
- Backend suite using in-memory MongoDB: passed; 138 cases, two existing
  real-database-only cases skipped. Python 3.12 was available locally; CI retains
  the production Python 3.11 and real MongoDB service configuration.
- Caddy 2.10.2 configuration validation: passed.
- Production routing smoke test against Caddy and the built bundle: passed,
  including real brand asset, deep links, missing assets, request/response
  cookies, Origin/CSRF forwarding, query paths and upstream 503 propagation.
- Both Railway TOML files parsed; `git diff --check` passed.

Docker is unavailable in the preparation environment. The image build itself,
real-MongoDB suite and full browser regressions are CI gates, not locally claimed
successes. Live Railway networking/TLS, secrets, Atlas access, staff provisioning,
OpenAI and Resend have not been configured or tested. No hosting deployment was
created, no production data changed, and no provider messages were sent.

Context7 library references used: `/railwayapp/docs`, `/caddyserver/website`.
The deploy guide links the corresponding primary documentation. Deployment
preparation does not constitute a complete dependency/security audit.
