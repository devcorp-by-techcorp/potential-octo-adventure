# Local app development

How to run the Expo app against a local backend, on web or native, with development accounts.
Development only: nothing here applies to production.

## 1. MongoDB replica set

Client invitations use transactions, so MongoDB must be a replica set. Start Docker
(`dockerd` on a Linux host without Docker Desktop), then run the disposable pinned set:

```bash
sudo dockerd &                         # skip if Docker is already running
bash backend/tests/start_mongodb.sh    # mongo:7.0.16, replica set "phase3", port 27017
```

The connection string is `mongodb://127.0.0.1:27017/?replicaSet=phase3`.

## 2. Backend with a development `.env`

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

Set at least these in `backend/.env`:

```
ENVIRONMENT=development
MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=phase3
MONGODB_DB_NAME=studio_suite_dev
AUTH_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8081
CORS_ORIGINS=http://localhost:5173,http://localhost:8081
```

`http://localhost:8081` is the Expo web dev server. Native requests send no `Origin` header, so
they need no entry in either list. Then start the API:

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` lets a phone or emulator on the same network reach it. Check
`curl http://localhost:8000/api/health`.

## 3. Development accounts

```bash
cd backend && python seed_dev_accounts.py
```

It prompts for a staff password and a client password (12 or more characters, read with
`getpass`; never passed as arguments). It refuses to run when `ENVIRONMENT=production`, and uses
only real paths: staff are provisioned as `staff.py` does, and the client is created by a public
enquiry, a staff invitation and invitation acceptance. Defaults are `staff@example.test` and
`client@example.test`; override with `--staff-email` and `--client-email`. Re-running is safe.

## 4. The app

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm install --frozen-lockfile
pnpm mobile
```

| Target | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Web (press `w`) | `http://localhost:8000` |
| Native on a LAN (simulator, emulator or device) | `http://<machine-ip>:8000` |

On native the URL is required; outside development it must be HTTPS. An Android emulator
reaches the host at `http://10.0.2.2:8000`. `EXPO_PUBLIC_WEB_URL` is the origin of the Vite web portal that
serves `/client` (`http://localhost:5173` in the example); it powers the client "Forgotten
password?" link, which is hidden when the variable is unset. The Studio role shows a note instead:
staff passwords are reset by the studio operator. Restart Expo after changing `.env`.

Web uses cookie sessions and so needs the origins in step 2. Native uses bearer tokens held in the
platform secure store.

## 5. Manual native check

1. Sign in as staff: it lands on the studio area.
2. Kill the app and relaunch: it is still signed in.
3. Sign out: it returns to marketing.
4. Sign in as the client: it lands on the client portal.

## Tests

```bash
cd backend && TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' pytest -q
BROWSER_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' \
  APP_TEST_PYTHON=backend/.venv/bin/python pnpm e2e:mobile
```

The e2e web export is built by `apps/mobile/e2e/build.js`, which blanks `EXPO_PUBLIC_API_URL` and
`EXPO_PUBLIC_WEB_URL` so a developer's `apps/mobile/.env` is never baked in; the tests always use
the same-origin proxy.
