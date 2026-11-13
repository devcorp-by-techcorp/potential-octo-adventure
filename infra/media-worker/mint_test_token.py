#!/usr/bin/env python3
"""Mint a gallery media token to verify the Worker. Matches the backend contract exactly.

Usage: CLOUDFLARE_WORKER_SHARED_SECRET=... python3 mint_test_token.py [gallery_id] [ttl_seconds]
"""
import base64, hashlib, hmac, json, os, sys, time

secret = os.environ["CLOUDFLARE_WORKER_SHARED_SECRET"].encode()
gallery_id = sys.argv[1] if len(sys.argv) > 1 else "gal_test"
ttl = int(sys.argv[2]) if len(sys.argv) > 2 else 14400  # 4-hour TTL by default
payload = {
    "gallery_ids": [gallery_id],
    "client_id": "client_test",
    "exp": int(time.time()) + ttl,
    "iat": int(time.time()),
}
encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
sig = hmac.new(secret, encoded.encode(), hashlib.sha256).hexdigest()
print(f"{encoded}.{sig}")
