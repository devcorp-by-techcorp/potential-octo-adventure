/**
 * IlluminateMyGallery — token-gated media delivery Worker.
 * Domain:  media.illuminatestudios.com.au
 * Serves:  thumbnails + previews from the PRIVATE R2 derivatives bucket.
 * Never serves originals (structurally rejected by the path validator).
 *
 * Security model: the gallery token is validated on EVERY request (private content).
 * The Cloudflare edge cache (via the Cache API) is consulted only AFTER the token is
 * validated, so a valid token is always required even for cached objects. The cache
 * key is the URL path only (never the token), so one cached object serves all
 * authorized viewers — which is what makes a burst release cheap.
 *
 * Two sets of cache headers, deliberately different:
 *  - the copy stored in the edge cache is long-lived and immutable (keys are versioned);
 *  - the response sent to the viewer is "private, no-cache", so no browser or
 *    downstream shared cache may reuse an image without coming back through the token
 *    check. A browser revalidates with If-None-Match and gets a bodyless 304.
 */

const TOKEN_COOKIE = "gallery_token";
// Stored with the object in the Worker's edge cache only; never sent to a viewer.
const EDGE_CACHE = "public, max-age=31536000, immutable";
// Sent to viewers: may be kept by the browser, but must be revalidated here every time.
const CLIENT_CACHE = "private, no-cache";
// Only versioned thumbnail/preview derivatives may be served. Originals excluded.
const ALLOWED_FILE = /^(thumb|preview)-v\d+\.webp$/;

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);
    let objectKey;
    try {
      objectKey = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    } catch {
      // Malformed percent-encoding is not a valid object key.
      return new Response("Not Found", { status: 404 });
    }
    const segments = objectKey.split("/");

    // 1. Structural path validation:
    //    prod/galleries/{gallery_id}/assets/{asset_id}/{thumb|preview}-v{n}.webp
    if (
      segments.length !== 6 ||
      segments[0] !== "prod" ||
      segments[1] !== "galleries" ||
      segments[3] !== "assets" ||
      !segments[2] || !segments[4] ||
      !ALLOWED_FILE.test(segments[5])
    ) {
      return new Response("Not Found", { status: 404 });
    }
    const galleryIdFromPath = segments[2];

    // 2. Token validation — ALWAYS, on every request.
    const token = readCookie(request, TOKEN_COOKIE);
    if (!token) return forbidden();

    const payload = await verifyToken(token, env.CLOUDFLARE_WORKER_SHARED_SECRET);
    if (!payload) return forbidden();

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now) return forbidden();
    if (
      !Array.isArray(payload.gallery_ids) ||
      !payload.gallery_ids.includes(galleryIdFromPath)
    ) {
      return forbidden();
    }

    // 3. Edge cache lookup (keyed on URL path only). Hit => no R2 read.
    //    The query string is dropped so it cannot be used to fragment the cache.
    const cache = caches.default;
    const cacheKey = new Request(url.origin + url.pathname, { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return toClient(request, cached, "HIT");

    // 4. Cache miss => fetch from the private derivatives bucket via R2 binding.
    const object = await env.DERIVATIVES_BUCKET.get(objectKey);
    if (!object || !object.body) return new Response("Not Found", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);           // Content-Type etc. from R2 metadata
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", EDGE_CACHE);
    headers.set("X-Content-Type-Options", "nosniff");
    if (!headers.has("Content-Type")) headers.set("Content-Type", "image/webp");

    const response = new Response(object.body, { status: 200, headers });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));   // populate edge cache
    return toClient(request, response, "MISS");
  },
};

function forbidden() {
  return new Response("Forbidden", {
    status: 403,
    headers: { "Cache-Control": "no-store" },
  });
}

// Rewrites the edge copy's headers for the viewer. Only reached after the token check.
function toClient(request, response, status) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", CLIENT_CACHE);
  headers.set("Vary", "Cookie");
  headers.set("X-Worker-Cache", status);

  const etag = headers.get("etag");
  if (etag && etagMatches(request.headers.get("If-None-Match"), etag)) {
    if (response.body) response.body.cancel();
    headers.delete("Content-Length");
    return new Response(null, { status: 304, headers });
  }
  return new Response(response.body, { status: 200, headers });
}

function etagMatches(ifNoneMatch, etag) {
  if (!ifNoneMatch) return false;
  const bare = (t) => t.trim().replace(/^W\//, "");
  return ifNoneMatch.split(",").some((t) => t.trim() === "*" || bare(t) === bare(etag));
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

async function verifyToken(token, secret) {
  if (!secret || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const encoded = token.slice(0, dot);
  const providedSigHex = token.slice(dot + 1);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encoded)
  );
  const expectedSigHex = bufToHex(sigBuf);

  if (!timingSafeEqualHex(providedSigHex, expectedSigHex)) return null;

  try {
    return JSON.parse(base64UrlDecode(encoded));
  } catch {
    return null;
  }
}

function bufToHex(buf) {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64UrlDecode(input) {
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad === 2) s += "==";
  else if (pad === 3) s += "=";
  else if (pad === 1) throw new Error("invalid base64url length");
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
