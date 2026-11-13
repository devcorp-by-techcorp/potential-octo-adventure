# illuminate-media-worker

Token-gated delivery of gallery thumbnails and previews from a **private** Cloudflare R2
bucket, on `media.illuminatestudios.com.au`.

```
MongoDB  → metadata only
R2       → image objects only
Worker + edge cache → serves thumbnails and previews
Backend  → authorises, signs, paginates, audits — and never streams image bytes
```

**Status: written and tested locally. Not deployed.** Nothing in a Cloudflare account has
been created or changed. Deployment needs the owner's account (see "Before you deploy").

## What it does

- Serves only `prod/galleries/{gallery_id}/assets/{asset_id}/{thumb|preview}-v{n}.webp`.
  Anything else, including `original.jpg`, is a 404, so originals are unreachable here.
- Checks the `gallery_token` cookie on **every** request: valid signature, not expired, and
  the gallery in the URL is in the token's `gallery_ids`. Otherwise 403.
- After the token check, serves from the edge cache; on a miss it reads R2 once and caches
  the object (key is the URL path only, so one cached object serves every authorised viewer).
- Responds `Cache-Control: public, max-age=31536000, immutable`. This is safe only because
  object keys are versioned and never overwritten: regenerate as `thumb-v2.webp`, never
  rewrite `thumb-v1.webp`.

Two small hardenings beyond the handoff brief's listing: a malformed percent-encoded path
returns 404 instead of throwing, and the query string is dropped from the cache key so it
cannot be used to force repeated R2 reads.

## Token contract (backend ⇄ Worker)

`base64url(json(payload))` + `.` + `hex(HMAC-SHA256(secret, <base64url part>))`, with `=`
padding stripped. Payload: `{ "gallery_ids": [...], "client_id": "...", "exp": <unix s>, "iat": <unix s> }`,
4-hour TTL. The backend sets it as an HttpOnly, Secure, SameSite=Strict cookie named
`gallery_token`. `mint_test_token.py` is a reference implementation of the minting side.

The secret `CLOUDFLARE_WORKER_SHARED_SECRET` must be byte-identical on the Worker
(Wrangler secret) and the backend (Railway environment variable). It is never committed.

## Test locally

```bash
npm test        # node test/worker.test.mjs — needs Node 20+ and python3, no Cloudflare account
```

Runs the Worker against an in-memory bucket and cache with tokens minted by
`mint_test_token.py`: valid/HIT/MISS, missing, tampered, forged, wrong-secret, expired and
wrong-gallery tokens, originals, bad paths, and failing closed when the secret is unset.

## Before you deploy — owner to confirm

1. The zone `illuminatestudios.com.au` is active (proxied) on the Cloudflare account.
2. R2 is enabled on that account.
3. The media hostname is `media.illuminatestudios.com.au`.
4. The production frontend origin for the originals bucket's CORS rule
   (the brief assumes `https://illuminatemygallery.com`).
5. **Caching decision:** media is token-checked on every request; the edge cache saves the
   R2 read, not the Worker invocation. A cache hit that skipped the Worker would serve
   private images to anyone holding the URL for up to a year.

## Deploy

```bash
wrangler whoami                                   # the right account?

# 1. Four private buckets. Public access stays OFF on all of them.
wrangler r2 bucket create illuminate-prod-derivatives    --location apac
wrangler r2 bucket create illuminate-prod-originals      --location apac
wrangler r2 bucket create illuminate-staging-derivatives --location apac
wrangler r2 bucket create illuminate-staging-originals   --location apac
wrangler r2 bucket list

# 2. Shared secret: generate once, set here and in Railway (same value).
openssl rand -hex 32
wrangler secret put CLOUDFLARE_WORKER_SHARED_SECRET

# 3. Deploy from this directory. The [[routes]] block creates the custom domain, DNS and TLS.
wrangler deploy
```

Do **not** use R2's "Connect Domain" on a bucket: that makes the bucket public and bypasses
the token check. The custom domain belongs to the Worker only.

Dashboard steps that Wrangler does not cover:

- Each bucket → Settings → Object lifecycle rules → abort incomplete multipart uploads after 7 days.
- R2 → Manage R2 API Tokens → Object Read & Write, scoped to the two prod buckets (a second
  token for the staging pair). These are the backend's `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.
- `illuminate-prod-originals` → Settings → CORS policy: `GET` from the confirmed frontend origin.

## Verify the live Worker

```bash
# seed a test object (any small .webp)
wrangler r2 object put illuminate-prod-derivatives/prod/galleries/gal_test/assets/img_test/thumb-v1.webp \
  --file=test.webp --content-type=image/webp

CLOUDFLARE_WORKER_SHARED_SECRET='<the secret>' ./verify.sh
# expect: 200, 403 ×4, 404, 405, then HIT

wrangler r2 object delete illuminate-prod-derivatives/prod/galleries/gal_test/assets/img_test/thumb-v1.webp
```

Trust the `X-Worker-Cache` header the Worker sets, not `cf-cache-status`, which can read
`DYNAMIC` for Worker responses even on a hit.

## Revocation

- Routine: the backend stops issuing tokens; existing ones expire within 4 hours.
- Archived gallery: the backend stops naming it in tokens; its derivatives become unreachable.
- Immediate takedown: the backend purges the URLs with the Cloudflare Cache Purge API, then
  archives the gallery.
- Rotating the secret invalidates every live token at once. Do it in a quiet window.

## Backend environment (for the backend session)

```
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
R2_ENDPOINT_URL=https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
R2_BUCKET_DERIVATIVES=illuminate-prod-derivatives
R2_BUCKET_ORIGINALS=illuminate-prod-originals
R2_CUSTOM_DOMAIN=https://media.illuminatestudios.com.au
CLOUDFLARE_WORKER_SHARED_SECRET=<identical to the Worker secret>
```

There is no public bucket and no `R2_BUCKET_PUBLIC`.
