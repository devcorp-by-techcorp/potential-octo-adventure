# Illuminate Studios public entry page

The entry page is a responsive React implementation of the included Illuminate
design source, using `@is/tokens`, local brand assets, and self-hosted fonts. It
includes a horizontal gallery reel, a keyboard-accessible photo viewer,
collection selection, a consent-based enquiry form, and Luma chat.

## Local operation

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev:web
```

In a second terminal:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
# Fill in MongoDB and OpenAI configuration, then:
uvicorn server:app --reload --port 8000
```

Vite proxies `/api` to port 8000 during development. For separate production
origins, set `VITE_BACKEND_URL` before building and configure `CORS_ORIGINS` on
the backend. Keep `OPENAI_API_KEY` on the backend exclusively. The production
bundle and Vite preview require either this configured backend origin or a
hosting reverse proxy for `/api`.

| Variable | Where | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Backend | Persistent enquiry and conversation storage |
| `MONGODB_DB_NAME` | Backend | Application database |
| `OPENAI_API_KEY` | Backend | Luma's OpenAI access |
| `OPENAI_MODEL` | Backend | Defaults to `gpt-4.1-mini`; use a model supporting Chat Completions JSON mode |
| `CORS_ORIGINS` | Backend | Comma-separated allowed frontend origins |
| `VITE_BACKEND_URL` | Web build | Backend origin; `/api` is appended |
| `RESEND_API_KEY` | Backend, optional | Studio email notification provider |
| `BOOKING_NOTIFICATION_EMAIL` | Backend, optional | Recipient for enquiry alerts |
| `BOOKING_FROM_EMAIL` | Backend, optional | Resend-verified sender |

## Enquiries and booking state

`POST /api/bookings` requires contact details, a preferred date, session type,
collection, explicit consent, and a UUID idempotency key. Phone, venue, and the
message are optional. Dates are validated against the studio's Melbourne date.
The server returns a reference only after persistence succeeds. The saved
state is always `awaiting_studio_confirmation`: submitting a form does not hold
availability, take payment, or confirm a booking.

Enquiries live in MongoDB's `booking_requests` collection. There is no public
endpoint exposing these records. Authorized staff can review these records in the
[persistent studio inbox](studio-enquiry-inbox.md) or enable email alerts. Internal
triage and private notes never change the customer-facing pending state. Stored enquiries
include the contact details, consent, reference, creation time, and notification
status. Apply your studio's retention process to enquiry records.

Identical retries use the same record and reference. Reusing an idempotency key
with different details returns 409. Database outages return 503; the form keeps
its inputs and shows the studio email instead of a false success message.

Optional notifications send the studio a plain-text email with a reply-to address
for the visitor. Failed delivery never discards the enquiry. Each alert has a
provider idempotency key and a recorded notification status. Retry pending,
failed, or unconfigured notifications after configuring the service:

```bash
cd backend
python notifications.py
```

The retry command processes up to 100 alerts per invocation and recovers claims
older than five minutes after a process interruption. Resend idempotency is
limited by the provider's retention window; inspect ambiguous old deliveries
before retrying them. A visitor receives a receipt in the page; this milestone
does not send a separate customer confirmation email.

## Luma

`POST /api/luma/chat` accepts only a user message and an optional opaque session
UUID. The server owns conversation history, the draft, and the booking state;
the browser cannot inject assistant messages or declare a confirmed booking.
Luma uses OpenAI Chat Completions with JSON mode to return a plain-text reply
and suggested form fields. It has no tools that reserve dates, send requests,
or confirm bookings. Visitors explicitly review the draft and consent in the
form before an enquiry is saved.

Responses pass the image-representation and booking-state checks derived from
`docs/luma-response-audit-fix/`. Invalid output is regenerated once, then replaced
with a safe response if it still fails. Provider failures show a recoverable
error and leave the enquiry form available. Successful form submission updates
the attached conversation to pending studio confirmation. Optimistic revisions
reject replies generated against a conversation changed during the API call.

Conversations contain personal information and are stored for at most one day
with a MongoDB TTL index (physical deletion follows MongoDB's TTL sweep).
The chat discloses OpenAI processing and storage. Rate limits bound calls per
IP and conversation; the IP limiter is process-local. Use deployment-level
limits for multiple replicas and configure trusted proxy handling before relying
on client IP limits behind a proxy. The app does not trust arbitrary forwarded
headers. The model has no live availability calendar; all dates require review.

The collection data in `web/src/data/studio.js` and Luma's catalogue prompt in
`backend/entry.py` must be updated together when studio prices change.

## UI and content

- Light and dark themes consume semantic tokens and persist the visitor's choice.
- Navigation targets real page sections. Studio access opens staff sign-in;
  see [studio authentication](studio-authentication.md) for setup and recovery.
  Client access opens invitation-only sign-in at `/client`. Unknown routes show a 404 page.
- Gallery images and fonts are bundled locally. Portfolio imagery is explicitly
  labelled as Unsplash samples. See `web/public/portfolio/README.md` for sources;
  replace them with approved studio work before a public launch.
- Cinzel, Cormorant Garamond, and Inter licences are included in `web/public/fonts/`.
- Native dialogs trap focus, support Escape, and restore focus. The photo viewer
  supports arrow keys. Submission cannot be dismissed while a save is in progress.
- Reel scrolling respects reduced-motion preferences. Mobile navigation and all
  primary actions remain available down to 320px.
- Copy follows the newer natural in-camera image policy instead of copying
  prohibited prototype wording. Prices and inclusions are proposal starting points.

## Verification

```bash
pnpm build
pnpm lint:web
cd backend
ruff check .
TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' pytest -q
```

The browser regression suite uses a test-only backend with a dedicated local
MongoDB and a deterministic model replacement. It never calls OpenAI or sends
real email. Activate the Python environment with backend dev dependencies,
install Chromium, and run the combined public/studio runner:

```bash
python -m playwright install chromium
# Use a test MongoDB only; the runner deletes studio_suite_browser_test.
BROWSER_MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=phase3 python web/tests/run_browser.py
```

Stop existing servers on ports 8000/5173 before launching the runner. The browser
suite verifies Luma-to-form prefilling, consent, saved receipts, pending-state
chat, API errors without false receipts, photo navigation and focus restoration,
mobile menu, persisted themes, portal routes and 404s. It checks overflow at
320, 390, 768, 1024, and 1440px. Screenshots go to the temporary directory;
`ENTRY_TEST_ARTIFACTS` can select another location and `ENTRY_TEST_URL` can select
another frontend address. Live provider verification requires real service
configuration and is separate from these deterministic checks.

Phase 3 replaces the `/client` placeholder with invitation-only sign-in and
read-only access to explicitly granted enquiries. See [client operations and
replica-set verification](client-invitations.md). Public submissions and Luma
remain unchanged and never confirm bookings. The runner retains all three
previous suites and appends `client_invitations.py`.
