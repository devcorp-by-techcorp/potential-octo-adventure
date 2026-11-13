# Client password recovery — gated candidate

The backend and frontend candidate implement optional client password recovery.
Self-service recovery is **disabled by default**. Live Resend delivery and the
recovery browser workflow have not been verified. Operator client reset/disable
commands remain available. This feature does not add staff recovery, public
registration, booking confirmation or new enquiry permissions.

Activation requires every condition below:

- `CLIENT_RECOVERY_ENABLED=true`.
- `CLIENT_RECOVERY_SENDER_VERIFIED=true`, set only after the operator verifies the
  existing `BOOKING_FROM_EMAIL` sender/domain with Resend.
- Existing `RESEND_API_KEY` and `BOOKING_FROM_EMAIL` configuration.
- `CLIENT_RECOVERY_ENCRYPTION_KEY`: a secret generated with `Fernet.generate_key()`.
- `CLIENT_RECOVERY_ORIGIN`: an exact entry in `AUTH_ALLOWED_ORIGINS`.
- Optional `CLIENT_RECOVERY_SECONDS` (60–3600; default 1800).

Invalid or incomplete activation settings keep recovery disabled. The verified
sender flag records an operator assertion; it does not authenticate a provider's
domain verification or demonstrate successful live delivery. Production origins
must meet the existing HTTPS origin validation. Keep the encryption key secret
and outside source control; loss prevents pending messages from being retried.

`GET /api/auth/client/recovery/status` reports only availability.
`POST /request` requires an allowed Origin and returns the same HTTP202 generic
message for enabled clients, unknown emails, disabled accounts and other roles.
Only an enabled existing client receives a token. Email and trusted connection
IP budgets use existing hashed MongoDB throttle buckets and TTL cleanup.
Requests are limited to three per email and ten per IP per15-minute window;
reset attempts are limited to20 per IP in that window. No forwarded IP header is
trusted independently. Database outages are reported as service errors.

Each request creates a fresh32-byte random token, stores only its SHA256 hash,
and transactionally creates a short-lived encrypted delivery outbox. The raw
token is present only in the encrypted payload and transient provider request.
Links carry the token in a URL fragment, never a query string. The UI immediately
removes the fragment and holds the token in memory, without local/session storage.
Multiple pending links may exist; consuming one changes the identity version and
invalidates every other link issued against the old version.

`POST /reset` requires an allowed Origin, a valid one-use token and a12–1024
character password. A replica-set transaction consumes the token and compares
the enabled client role/identity version before saving the existing Argon2id
password format. An operator reset, disable, role change, expiry or replay denies
the reset. Reset never re-enables an account and does not sign the holder in.
The new identity version immediately invalidates all previous client sessions.
The client cookie is cleared and queued old-version payloads are cancelled/purged.

The Resend adapter uses the established fixed HTTPS email endpoint. Each outbox
job uses one fixed idempotency key and identical encrypted payload for retries.
An uncertain send remains retryable; duplicate workers atomically claim delivery.
Claims can be recovered after five minutes, at most five attempts, before expiry.
Successful/cancelled jobs purge their encrypted payload; TTL indexes remove expired
tokens, payloads and throttle records. Expiry is checked explicitly, independently
of delayed TTL cleanup. Run `python client_recovery.py` from `backend/` to retry
up to100 pending jobs. The worker must be scheduled operationally before enabling
delivery; no paid service or live schedule was created here.

Resend [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
last24 hours; this candidate's maximum one-hour token lifetime keeps retries inside
that window. Outbox protection uses authenticated
[Fernet encryption](https://cryptography.io/en/46.0.7/fernet/), pinned to the tested
`cryptography==46.0.7` dependency. No provider response, token or recipient is logged.

Backend regression command:

```sh
TEST_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' \
  .venv/bin/python -m pytest -q backend/tests/test_client_recovery.py
```

Tests use fake Resend transport and real MongoDB transactions. They cover default
disable, generic request responses, token hashing, single use, session invalidation,
concurrent consumption, operator changes, expiry, origin checks, throttling,
encrypted retry payloads, claim concurrency and provider adapter error handling.
These adapter tests do not establish live sender verification or successful email
delivery. Browser/provider activation remains a specific verification dependency;
do not describe the candidate as release-ready until those checks pass.
