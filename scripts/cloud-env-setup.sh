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

# 3. Chromium for the repo's pinned Python Playwright (web browser suites).
#    Node Playwright and its Chromium are pre-installed in the container.
backend/.venv/bin/python -m playwright install chromium \
  || echo "setup: WARNING Python Playwright browser download failed; web browser suites unavailable"

# 4. Wrangler for the gallery media Worker (infra/media-worker). Auth comes from
#    CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID environment secrets, never from files.
npm install --global --no-fund --no-audit wrangler@4.156.0

echo "setup: done"
