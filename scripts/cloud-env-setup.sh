#!/usr/bin/env bash
# Studio Suite cloud environment setup. Runs as root from the folder holding the checkouts.
set -euo pipefail

REPO=potential-octo-adventure
if [ ! -d "$REPO" ]; then
  echo "setup: $REPO not in this session; nothing to do"
  exit 0
fi
cd "$REPO"

# 1. Node workspace: tokens, web (React 19) and apps/mobile (Expo, React 18).
corepack enable
corepack prepare pnpm@10.34.3 --activate
pnpm install --frozen-lockfile
pnpm build:tokens

# 2. Backend: Python dev tooling in backend/.venv (gitignored).
python3 -m venv backend/.venv
backend/.venv/bin/pip install --quiet --upgrade pip
backend/.venv/bin/pip install --quiet -r backend/requirements-dev.txt

# 3. Chromium build for Playwright 1.58, pinned by both backend/requirements-dev.txt (web suites)
#    and apps/mobile (app e2e). One download serves both. The container's pre-installed Chromium
#    is a different build, so without cdn.playwright.dev neither browser suite can launch.
backend/.venv/bin/python -m playwright install chromium \
  || echo "setup: WARNING Chromium download failed (allow cdn.playwright.dev); browser suites unavailable"

# 4. Cloudflare tooling: Wrangler for infra/media-worker (it has a Wrangler config), cf for the
#    rest. Auth comes from the CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID secrets, never files.
npm install --global --no-fund --no-audit wrangler@4.156.0 cf@1.0.0-beta.26

# 5. Pre-pull the MongoDB image the backend and app tests use. dockerd is started only for the
#    pull and stopped again, so no daemon is left running; sessions start it when they need it.
if command -v dockerd >/dev/null 2>&1 && ! docker info >/dev/null 2>&1; then
  dockerd >/tmp/setup-dockerd.log 2>&1 &
  DOCKERD_PID=$!
  for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 1; done
  docker pull --quiet mongo:7.0.16 || echo "setup: WARNING could not pre-pull mongo:7.0.16"
  kill "$DOCKERD_PID" && wait "$DOCKERD_PID" || true
fi

echo "setup: done"
