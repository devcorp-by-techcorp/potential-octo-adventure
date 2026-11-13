# Luma chat reliability investigation — 9 October 2026

## Scope and evidence

The user reports that Luma chat does not work in the deployed Studio Suite v2 application. The repository main baseline examined was `1d06dab0e4b597e25e7f8d3c9f45a66baf1558b8`. The public landing chat submits to `POST /api/luma/chat` through the same-origin Caddy `/api` proxy; the backend uses MongoDB session state and OpenAI Chat Completions. The feature is present in source, but source presence does not establish live operation.

Previous Railway preview evidence records successfully deployed web and backend, database readiness, and an earlier malformed `OPE$NAI_API_KEY` environment variable replaced with `OPENAI_API_KEY`. That historical configuration repair does **not** verify the present provider credential, billing, model access, live API response or current deployed SHA.

The live preview endpoint could not be reached from the investigation tools, so **the exact current production failure is not established**. Do not report this issue as fully resolved on the basis of local or hosted CI alone.

## Failure paths addressed on this branch

- Public chat previously attempted a MongoDB TTL `create_index` write for each first conversation. Remove that per-request schema operation; `initialize_database.py` owns the TTL index and required schema provisioning.
- OpenAI error handling previously collapsed 401, 429 and 5xx without actionable server logs. Emit status/class only, never keys, prompts or private provider bodies. Retry only transient 429/502/503/504 and timeouts once, with a short fixed pause. Reject 401 without retry.
- If model policy regeneration fails transiently, return a vetted server-owned reply and do not use the invalid candidate's draft. Keep normal initial-provider failure as HTTP 503 with the enquiry-form fallback.
- Use Melbourne-local day when passing the current date into the server-controlled Luma prompt.
- Display the visitor's message while waiting. If the request fails, restore the unsent text to the input and show a clear error, rather than implying the submission succeeded. Starting a separate enquiry clears the prior completed session.
- Add real-backend unit regressions for transient recovery, 401 handling and policy-safe regeneration fallback. Add browser coverage for an offline/unavailable chat and successful resend.

## Required preview acceptance

1. Confirm the exact deployment SHA and successful backend/web builds in the **preview** environment. Check web `/healthz`, `/api/health` and `/api/ready` separately; neither healthy process nor MongoDB readiness proves OpenAI connectivity.
2. In Railway backend **only**, confirm `OPENAI_API_KEY` is present and valid, and that `OPENAI_MODEL` references an available model. Check provider account quotas/access privately. Never output or log the key. The web service must not receive `OPENAI_API_KEY`.
3. Confirm `MONGODB_DB_NAME` targets the intended preview DB, pre-deploy schema check passes, and `luma_sessions` retains its TTL index. Do not bypass schema readiness.
4. From the deployed web origin, open Ask Luma and send a synthetic visitor message. Verify `POST /api/luma/chat` is HTTP 200 with a non-empty `reply`, `session_id`, and collecting state. Verify a second message retains its session, and the inquiry-review form receives only explicit visitor facts.
5. Simulate a failed chat request in a controlled test: the user text must remain retryable, error visible, and no confirmation implied. Verify a successful resend.
6. Verify safe policy language and booking-state behavior. Final booking enquiry remains unconfirmed until reviewed by the studio. Do not introduce automatic booking confirmation.
7. Confirm exact branch CI: Python lint/backend tests, web lint/build/real-browser suite and production Caddy proxy smoke. Merge and deploy only after gates pass and separate release authorization, then repeat live preview acceptance.

## Safety and release boundary

No provider credentials, private production data, reservations, payment actions or booking confirmations are included in this change. This branch is remediation plus tests only; deploying it without an end-to-end provider smoke does not close the reported live incident.
