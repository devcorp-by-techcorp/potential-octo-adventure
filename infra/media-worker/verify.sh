#!/usr/bin/env bash
# Live verification of the deployed media Worker. Run AFTER deploy, with the test
# object seeded (see README). Needs CLOUDFLARE_WORKER_SHARED_SECRET in the
# environment: the same value set on the Worker. Exits non-zero if any check fails.
set -u
: "${CLOUDFLARE_WORKER_SHARED_SECRET:?set CLOUDFLARE_WORKER_SHARED_SECRET to the secret set on the Worker}"
BASE="${BASE:-https://media.illuminatestudios.com.au}"
GALLERY="${GALLERY:-gal_test}"
KEY="prod/galleries/$GALLERY/assets/img_test/thumb-v1.webp"
HERE="$(cd "$(dirname "$0")" && pwd)"
TOKEN="$(python3 "$HERE/mint_test_token.py" "$GALLERY")"
EXPIRED="$(python3 "$HERE/mint_test_token.py" "$GALLERY" -60)"
fail=0

check() { # name expected actual
  if [ "$2" = "$3" ]; then
    echo "PASS  $1 ($3)"
  else
    echo "FAIL  $1: expected $2, got $3"
    fail=1
  fi
}
code() { curl -sS -o /dev/null -w '%{http_code}' "$@"; }
cache_status() {
  curl -sS -o /dev/null -D - -H "Cookie: gallery_token=$TOKEN" "$BASE/$KEY" \
    | tr -d '\r' | grep -i '^x-worker-cache:' | cut -d' ' -f2
}

check "valid token + real object" 200 "$(code -H "Cookie: gallery_token=$TOKEN" "$BASE/$KEY")"
check "no token" 403 "$(code "$BASE/$KEY")"
check "tampered token" 403 "$(code -H "Cookie: gallery_token=${TOKEN}x" "$BASE/$KEY")"
check "expired token" 403 "$(code -H "Cookie: gallery_token=$EXPIRED" "$BASE/$KEY")"
check "wrong gallery" 403 "$(code -H "Cookie: gallery_token=$TOKEN" "$BASE/prod/galleries/gal_other/assets/img_test/thumb-v1.webp")"
check "original via media domain" 404 "$(code -H "Cookie: gallery_token=$TOKEN" "$BASE/prod/galleries/$GALLERY/assets/img_test/original.jpg")"
check "POST refused" 405 "$(code -X POST -H "Cookie: gallery_token=$TOKEN" "$BASE/$KEY")"
cache_status >/dev/null
check "repeat request served from the edge" HIT "$(cache_status)"
exit $fail
