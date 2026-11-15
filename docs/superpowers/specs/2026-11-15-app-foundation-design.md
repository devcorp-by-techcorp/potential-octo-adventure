# App foundation: one Expo application on web and native, connected to the backend

Date: 15 November 2026. Status: draft for owner approval.

This is step 1 of the plan to make the Expo application (`apps/mobile`) fully operational
against the FastAPI backend (`backend/`). Later steps each get their own design.

## Intent

The studio needs one professional application that works on every device:

- **Desktop web** is the primary way the studio runs its business. Clients who prefer a desktop,
  such as childcare centre managers, also use it.
- **Native phone and tablet apps** serve studio staff in the field, and anyone without a desktop.

The Expo application already has nearly every page and feature, but it runs on seeded,
in-memory data. Nothing is released until every page, feature and service works against
real data and has been tested. The owner was clear that partial releases are not wanted.

Step 1 lays the groundwork every later step depends on: the app can reach the backend, staff
and clients can sign in with real accounts on web and native, and sessions survive restarts.

## Decisions already made by the owner

1. **One application.** `apps/mobile` (Expo) becomes the single studio and client application
   on desktop web, iOS and Android. The Vite app in `web/` keeps the public marketing site and
   Luma. Its studio and client portals keep running until the Expo app matches them, and are
   then retired.
2. **Hybrid sign-in.** In a browser, the app uses the backend's existing cookie sessions
   unchanged. In the native app, it uses bearer tokens.
3. **Booking confirmation follows the backend.** Confirming an enquiry creates a planning
   booking. Moving it to confirmed stays refused (HTTP 409) until the scheduling, authority and
   agreement/payment checks are built. That work comes in a later step, not this one.
4. **Domains.** `illuminatestudios.com.au` is the primary company domain and the entry to the
   website and application. `illuminatemygallery.com.au` is for gallery services and direct
   client portal access.

## Overall plan (context)

1. **Foundation (this document):** API client, hybrid sign-in, persistent sessions.
2. **Enquiries, bookings and contacts:** public enquiry form, inquiry triage, bookings,
   tracker, contacts and dashboard, all on endpoints that already exist.
3. **Content, documents and the client portal home:** the backend partly supports these.
4. **New backend services:** inbox and e-signature, finance, Illuminate Kids, staff management.
5. **Galleries and prints:** these depend on the media Worker being deployed.

## Goals

- The app signs staff and clients in against the real backend on desktop web, iOS and Android.
- A signed-in user stays signed in across app restarts and page reloads until the session
  expires or is revoked. Then they are returned to sign-in with a clear message.
- Signing out ends the session on the server, not only on the device.
- "Sign out other devices" covers web and native sessions together.
- Every later screen talks to the backend through one API client that handles credentials,
  CSRF, errors and expiry in one place.
- The existing web portals and the public site keep working with no changes for their users.

## Non-goals

- No business screens are wired to real data in this step. They keep their seeded data until
  their own step.
- No new account types and no self-registration. Staff accounts stay operator-managed. Clients
  still join by invitation.
- No password reset or invitation acceptance inside the native app in this step. Both stay on
  the web flow, which already exists.
- No production deployment of the Expo web build. Step 1 is proven locally and in CI.

## Anti-goals (what would make this a failure even if it works)

- Any weakening of the browser's protections. Cookie sessions keep their Origin and CSRF checks
  exactly as they are.
- A token that works somewhere it shouldn't: a bearer token accepted as a cookie, a cookie token
  accepted as a bearer token, or a staff token accepted for a client, or the reverse.
- A token stored anywhere but the platform's secure storage on native, or exposed to page
  JavaScript on web.
- Two divergent session systems. There is one session record per sign-in, in the existing
  collections, whatever device it came from.

## Approaches considered

1. **Hybrid: cookies on web, bearer tokens on native (chosen).** Same session records and
   checks. The web keeps today's protections. Native gains token endpoints. The cost is a
   security-sensitive backend change, which needs thorough tests.
2. **Native app imitates a browser** (keeps cookies and sends a made-up Origin). No backend
   change, but it fakes the header the backend's protection relies on, and Android cookie
   handling is unreliable. Rejected.
3. **Web build only, native later.** Quickest, but it does not deliver working phone apps,
   which are part of the bar for done. Rejected on its own. Its web half is part of option 1.

## Design

### Backend: bearer sessions beside cookie sessions

- **Session records** gain a `transport` field: `"cookie"` or `"bearer"`. Records written
  before this change have no field and are treated as `"cookie"`. Staff sessions stay in
  `staff_sessions` and client sessions in `client_sessions`, so the two roles cannot be swapped.
- **New sign-in endpoints**, one per role: `POST /api/auth/token` (staff) and
  `POST /api/auth/client/token` (client).
  - Same request body, password checks, throttles and error messages as the existing login
    endpoints.
  - They set no cookie. They return the token in the response body, with the identity and
    expiry, and write the session with `transport: "bearer"`.
  - They do not require an Origin header. Native apps send none, and the throttles still apply.
- **Authenticating a request**, in `require_staff` and `require_client`:
  - With an `Authorization: Bearer` header, the token is looked up and accepted only if its
    session has `transport == "bearer"`.
  - With a session cookie, the token is accepted only if its session is `"cookie"`.
  - A request carrying both is refused (401), so precedence can never be ambiguous.
  - Expiry, revocation, account-enabled and `auth_version` checks are unchanged for both.
- **Writes**, in `require_staff_write` and `require_client_write`: bearer requests skip the
  Origin and CSRF checks, which defend only against cookies being sent without the user's
  knowledge. Cookie requests keep both checks exactly as today. Any other write fencing in the
  backend (for example `fence_staff_write`) must work for both transports.
- **Sign-out**: the existing logout endpoints revoke the current session whichever transport
  it used.
- **Session counts** and "revoke others" count and revoke across both transports.
- **Endpoints that read the cookie directly** must be found and made transport-aware, or
  explicitly limited to cookies. An example is invitation acceptance, which checks for an
  existing client cookie.

### App: one API client, two credential modes

- **Base URL:** on web, requests go to the same origin, `/api/...`. In local development, the
  Expo web dev server reaches the backend on port 8000 (see "Local development"). On native,
  the base URL comes from app config (`EXPO_PUBLIC_API_URL`), and production must use HTTPS.
- **Web mode:** `fetch` with `credentials: "include"`. After sign-in, or a session read, the app
  keeps the returned `csrf_token` in memory only and sends it as `X-CSRF-Token` on writes. The
  cookie stays httpOnly and is never visible to the app.
- **Native mode:** the token is stored in `expo-secure-store` (Keychain on iOS, Keystore on
  Android) and sent as `Authorization: Bearer`. It is never written to AsyncStorage, logs or
  analytics.
- **Errors:** one typed error shape. A 401 clears local session state and sends the user to
  sign-in with the backend's message. A 403, 409 or 422 is surfaced to the screen. Network
  failures and 503s show a retryable "temporarily unavailable" state.
- **Concurrency:** if several requests fail with 401 at once, they trigger only one sign-out
  and one redirect.

### App: session state

- `src/state/session.tsx` is replaced with a real session provider:
  - states: `restoring`, `signed-out`, `staff`, `client`;
  - actions: `signIn(role, email, password)`, `signOut()`, `restore()`.
- **On start, web:** call the session endpoint for each role (`GET /api/auth/session`, then
  `GET /api/auth/client/session`) to find out whether a cookie session exists.
- **On start, native:** read the stored token and role, then validate them with the matching
  session endpoint. A stored token that fails validation is deleted.
- **Route guarding:** while `restoring`, the app shows a neutral splash, never seeded data.
  The `(admin)` routes require `staff` and the `(client)` routes require `client`, and the
  wrong role goes back to its own home. The persona redirect in `app/index.tsx` reads the
  real state.
- **Sign-in screen:** the existing role toggle (Studio or Client) chooses the endpoint. The
  pre-filled demo emails are removed. Errors show the backend's messages unchanged. Password
  reset and invitation acceptance link out to the web flow.

### Local development

- One documented command set runs the backend, the MongoDB replica set and the Expo app
  (web or native) together.
- For the Expo web dev server, the backend's development settings allow its origin in
  `AUTH_ALLOWED_ORIGINS` and CORS with credentials. Same-origin is used where Metro can proxy
  `/api`.
- Native development reaches the backend over the machine's LAN address through
  `EXPO_PUBLIC_API_URL`.
- A seed command creates one staff account and one client account for local testing, using
  the existing operator provisioning paths rather than direct database writes.

## Testing (how "done" is proven)

- **Backend, pytest against the real replica set:**
  - bearer sign-in for each role;
  - cross-transport refusal in both directions;
  - cross-role refusal;
  - refusal when a request carries both a bearer header and a cookie;
  - expiry, revocation and `auth_version` invalidation for bearer tokens;
  - bearer writes succeed with no Origin or CSRF header;
  - cookie writes still require both;
  - logout and "revoke others" across transports;
  - throttling on the token endpoints.
- **Existing suites stay green unchanged:** backend 394 passed, web browser regressions,
  mobile e2e and CI. An existing test that needs changing is a red flag to raise, not to work
  around.
- **App:**
  - unit tests for the API client: credential mode, CSRF, the 401 path and concurrent 401s;
  - a browser test of the Expo web build against a real local backend: sign in as staff and
    as client, reload and stay signed in, sign out, expired session, wrong-role route;
  - native sign-in, restart persistence and sign-out checked on an iOS simulator or Android
    emulator, or on a device through Expo, and recorded in the test report. If no simulator or
    device is available in the session, that limit is stated plainly. It is not reported as
    passed.

## Builder's calls

These are left to the builder:

- module layout inside `src/api/` and `src/state/`;
- how endpoints are typed;
- whether shared backend code is refactored into one helper or kept per role;
- whether Metro proxies `/api` in local web development or CORS is used.

## Decisions marked as Claude's calls, for the owner to check

- **Native sessions use the same lifetime as web**, 8 hours by default (`AUTH_SESSION_SECONDS`),
  so field staff sign in again each working day. A longer native lifetime, or a biometric
  re-unlock, can be added later if wanted.
- **If one browser holds both a staff and a client cookie session**, the app restores the role
  the user last signed in as. It remembers that role, which is not secret, in local storage,
  and the user can switch from the account menu.
- **Invitation acceptance and password reset stay on the web** in this step. The native app
  links to them.
- **Hosting of the Expo web build** is decided at deployment. The working assumption is that
  the studio and client application is served from its own origin on
  `illuminatestudios.com.au` (for example `app.illuminatestudios.com.au`), with client access
  also on `illuminatemygallery.com.au`. Each origin proxies `/api` to the backend, so cookies
  stay first-party. Each origin has its own cookie sessions.
