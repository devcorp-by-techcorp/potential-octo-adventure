# Studio Suite integration verification — 2026-10-05

Repository: `devcorp-by-techcorp/studio-suite_v2`
Branch: `codex/studio-suite-integrated-development`
Integrated base: `aa50bd2` (`claude/illuminate-gallery-rebuild-deploy-dy6bie`)
Application code was tested at commit `2e87190ec2dd9086c2ef4b1ccc2061bf3380fbaf`; later commits only synchronize reports/handoff. Draft PR: https://github.com/devcorp-by-techcorp/studio-suite_v2/pull/12. GitHub Actions runs 37229839711 (code checkpoint), 37230360832 and 37230858753 (documentation-only follow-ups) passed all three jobs. Not release-ready.
Production status: no production deployment or production database was used.

## Consolidation and behavior changes

The current default includes merged PR #8 and subsequent PR #9–#11 work. This working branch carries forward client invitations/access, transactional replica-set CI and the Railway/Caddy same-origin deployment baseline. Router registration, privacy paths, frontend routes, browser runner and existing booking change work have been reconciled with that live base.

The booking confirmation transition was disabled because no authoritative resource/capacity model or date-conflict rule exists. Staff UI shows a disabled confirmation control and reason; API requests to move planning → confirmed return HTTP 409 without changing stored booking content. Existing confirmed records remain readable for compatibility. Enquiries, invitation issue/acceptance, Luma/conversations and date/time proposal drafts do not reserve availability.

Current checkpoint also includes persisted proposal drafts, selective client-access revocation, explicit-grant messaging, private document versions and protected delivery, persistent contacts, Mongo-backed reporting, public narrative draft/publish/versioning, indexed enquiry search/export/bulk triage and a partial Expo app. See `docs/development/feature-status.md` for workflow boundaries and status.

## Verification evidence

Passed during this session:

- `TEST_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' .venv/bin/pytest -q backend/tests` — full suite reached 100% with no failures against MongoDB 7.0.16 replica set `phase3`. One upstream Starlette `multipart` pending-deprecation warning remains. The 17-case booking module also passed separately after correcting a test-only datetime precision assumption.
- `.venv/bin/ruff check backend web/tests` and `git diff --check` — passed.
- `PATH=/home/techcorp2024/.nvm/versions/node/v22.22.1/bin:$PATH pnpm lint:web` — passed.
- `PATH=/home/techcorp2024/.nvm/versions/node/v22.22.1/bin:$PATH pnpm build` — passed; workspace token build and Vite production build, 340.30 KB JS / 102.43 KB gzip.
- `CADDY_BINARY=/home/techcorp2024/studio-suite-tools/caddy .venv/bin/python web/tests/production_server.py` — production routing smoke test passed using temporary loopback services.
- Expo mobile typecheck, lint, test (1 origin-validation case), and web/Android/iOS exports — passed. This origin test is not a device authentication test.
- All 12 configured real-browser suites have passed in focused runs across the current and immediately preceding verification checkpoints: public entry, staff auth, enquiry inbox, invitations/revocation, bookings, reporting, booking drafts, conversations, contacts, public content, enquiry operations, and private documents. Results include two-session messaging/read state, explicit publication and safe plain text, paged export and uncertain bulk-write recovery, private document retry/version/download/unpublish, mobile viewport overflow checks, and grant withdrawal.
- The aggregate browser runner exposed short UI-only waits in inbox and invitation tests. Those assertions now synchronize on real API responses; both affected suites pass independently. One single aggregate all-12 run was not rerun to green after these fixes; hosted CI remains an integration check.
- GitHub runs 37229839711, 37230360832 and 37230858753 passed backend Ruff/pytest, web build/ESLint and its public-entry/auth/inbox/invitation browser block, and the production Docker image/Caddy routing block. The latest run is on a documentation-only revision. The CI workflow does not include the new feature-specific browser suites; those were verified locally in focused runs.

Pending:

- New-commit GitHub hosted CI and Docker image build, to be checked after pushing. The local environment has no Docker daemon.
- Recheck current branch and CI at the start of the next session before further integration.

## Provider, business and deployment limits

Cloudflare R2 credentials/private Worker access and media derivative/delivery requirements are not available; local storage adapter behavior does not prove live R2 success. Signature provider, consent and evidence requirements remain unspecified. Payment provider and commercial amount/tax/deposit/refund/fulfilment policy remain unspecified. Retention/deletion policy remains unspecified. No real provider message was sent. Client self-service recovery is a default-disabled, unregistered candidate and is not a supported account-recovery flow. Mobile native secure credential storage and device/browser authentication are incomplete.

Docker daemon is unavailable on the host; hosted PR CI must establish the production image build. No live deploy, shared-default merge, destructive migration, or real customer communication took place.

## Next actions

At the next session, recheck the live PR base/head and statuses before continuing. Keep PR #12 draft; do not merge or deploy.

## Continuation correction — 2026-10-05

The earlier claim that hosted CI covered only four browser suites was incorrect.
Direct readback of run `37231182661`, web job `111520959508`, confirms successful
logs for all twelve configured suites, including documents, conversations,
contacts, reporting, proposals, content and enquiry operations. The CI step label
was stale; the runner already executed the full set. The continuation adds an
account-session suite and explicit per-suite progress. See
[session security verification](2026-10-05-session-security-verification.md)
for the subsequent code checkpoint, regression fixes and exact current results.
