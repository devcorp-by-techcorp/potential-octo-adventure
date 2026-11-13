// Local test of the Worker: runs src/worker.js in Node against an in-memory R2
// bucket and edge cache, with tokens minted by mint_test_token.py (the backend
// contract). No Cloudflare account needed.  Run: node test/worker.test.mjs
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import worker from "../src/worker.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SECRET = "local-test-secret-not-a-real-one";
const mint = (gallery, ttl, secret = SECRET) =>
  execFileSync("python3", [path.join(here, "../mint_test_token.py"), gallery, String(ttl)],
    { env: { ...process.env, CLOUDFLARE_WORKER_SHARED_SECRET: secret } }).toString().trim();

// In-memory stand-ins for the Workers runtime.
const store = new Map();
let r2Reads = 0;
globalThis.caches = {
  default: {
    async match(req) { const r = store.get(req.url); return r ? r.clone() : undefined; },
    async put(req, res) { store.set(req.url, res); },
  },
};
const objects = new Map([
  ["prod/galleries/gal_test/assets/img_test/thumb-v1.webp", { body: "THUMB", type: "image/webp" }],
  ["prod/galleries/gal_test/assets/img_test/preview-v2.webp", { body: "PREVIEW", type: null }],
  ["prod/galleries/gal_test/assets/img_test/original.jpg", { body: "ORIGINAL", type: "image/jpeg" }],
]);
const env = {
  CLOUDFLARE_WORKER_SHARED_SECRET: SECRET,
  DERIVATIVES_BUCKET: {
    async get(key) {
      r2Reads++;
      const o = objects.get(key);
      if (!o) return null;
      return { body: new Response(o.body).body, httpEtag: '"etag"', writeHttpMetadata(h) { if (o.type) h.set("Content-Type", o.type); } };
    },
  },
};
const pending = [];
const ctx = { waitUntil: (p) => pending.push(p) };
const BASE = "https://media.illuminatestudios.com.au/";
const KEY = "prod/galleries/gal_test/assets/img_test/thumb-v1.webp";
const call = async (pathname, { token, method = "GET", etag } = {}) => {
  const headers = token ? { Cookie: `session=abc; gallery_token=${token}` } : {};
  if (etag) headers["If-None-Match"] = etag;
  const res = await worker.fetch(new Request(BASE + pathname, { method, headers }), env, ctx);
  await Promise.all(pending.splice(0));
  return res;
};
const status = async (pathname, opts) => (await call(pathname, opts)).status;

const results = [];
const ok = (name, cond, extra = "") => results.push(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + extra}`);
const good = mint("gal_test", 14400);

let r = await call(KEY, { token: good });
const clientSafe = (x) => x.headers.get("Cache-Control") === "private, no-cache" && x.headers.get("Vary") === "Cookie";
ok("valid token + real object → 200, MISS, webp, viewer must revalidate",
  r.status === 200 && r.headers.get("X-Worker-Cache") === "MISS" && clientSafe(r) &&
  r.headers.get("Content-Type") === "image/webp" && (await r.text()) === "THUMB", `${r.status} ${r.headers.get("X-Worker-Cache")}`);
const readsAfterMiss = r2Reads;
r = await call(KEY, { token: good });
ok("second request → HIT with no further R2 read, viewer must still revalidate", r.status === 200 && r.headers.get("X-Worker-Cache") === "HIT" && clientSafe(r) && r2Reads === readsAfterMiss && (await r.text()) === "THUMB");
ok("edge copy keeps the long-lived immutable header", store.get(BASE + KEY).headers.get("Cache-Control") === "public, max-age=31536000, immutable");
r = await call(KEY, { token: good, etag: '"etag"' });
ok("revalidation with a valid token → 304, no body", r.status === 304 && clientSafe(r) && (await r.text()) === "" && r2Reads === readsAfterMiss);
r = await call(KEY, { token: good, etag: 'W/"other", W/"etag"' });
ok("weak / listed validators match → 304", r.status === 304);
r = await call(KEY, { token: good, etag: '"stale"' });
ok("non-matching validator → 200 with body", r.status === 200 && (await r.text()) === "THUMB");
ok("revalidation without a token → 403, never 304", (await status(KEY, { etag: '"etag"' })) === 403);
ok("revalidation with an expired token → 403, never 304", (await status(KEY, { token: mint("gal_test", -60), etag: '"etag"' })) === 403);
r = await call(KEY);
ok("cached object still needs a token → 403, not cacheable", r.status === 403 && r.headers.get("Cache-Control") === "no-store");
ok("tampered signature → 403", (await status(KEY, { token: good + "x" })) === 403);
const [enc, sig] = good.split(".");
const forged = Buffer.from(JSON.stringify({ gallery_ids: ["gal_test", "gal_other"], client_id: "x", exp: 9999999999, iat: 0 })).toString("base64url");
ok("edited payload with the old signature → 403", (await status(KEY, { token: `${forged}.${sig}` })) === 403);
ok("token signed with a different secret → 403", (await status(KEY, { token: mint("gal_test", 14400, "another-secret") })) === 403);
ok("expired token → 403", (await status(KEY, { token: mint("gal_test", -60) })) === 403);
ok("token for another gallery → 403", (await status("prod/galleries/gal_other/assets/img_test/thumb-v1.webp", { token: good })) === 403);
ok("garbage token → 403", (await status(KEY, { token: "not-a-token" })) === 403 && (await status(KEY, { token: `${enc}.` })) === 403);
ok("original through the media domain → 404", (await status("prod/galleries/gal_test/assets/img_test/original.jpg", { token: good })) === 404);
ok("unversioned or wrong file names → 404",
  (await status("prod/galleries/gal_test/assets/img_test/thumb.webp", { token: good })) === 404 &&
  (await status("prod/galleries/gal_test/assets/img_test/thumb-v1.webp.exe", { token: good })) === 404);
ok("wrong path shape → 404",
  (await status("staging/galleries/gal_test/assets/img_test/thumb-v1.webp", { token: good })) === 404 &&
  (await status("prod/galleries/gal_test/thumb-v1.webp", { token: good })) === 404 &&
  (await status("", { token: good })) === 404);
ok("encoded slash cannot smuggle a path → 404", (await status("prod/galleries/gal_test/assets/img_test%2F..%2Fx/thumb-v1.webp", { token: good })) === 404);
ok("malformed percent-encoding → 404, not a crash", (await status("prod/galleries/gal_test/assets/%E0%A4%A/thumb-v1.webp", { token: good })) === 404);
ok("valid path, object missing in R2 → 404", (await status("prod/galleries/gal_test/assets/nope/thumb-v1.webp", { token: good })) === 404);
r = await call("prod/galleries/gal_test/assets/img_test/preview-v2.webp", { token: good });
ok("preview served; Content-Type falls back to image/webp", r.status === 200 && r.headers.get("Content-Type") === "image/webp" && r.headers.get("X-Content-Type-Options") === "nosniff");
ok("POST → 405", (await status(KEY, { token: good, method: "POST" })) === 405);
const before = r2Reads;
r = await call(KEY + "?cachebust=1", { token: good });
ok("query string cannot fragment the cache", r.headers.get("X-Worker-Cache") === "HIT" && r2Reads === before);
env.CLOUDFLARE_WORKER_SHARED_SECRET = undefined;
ok("secret not configured → 403 (fails closed)", (await status(KEY, { token: good })) === 403);

console.log(results.join("\n"));
const bad = results.filter((x) => x.startsWith("FAIL")).length;
console.log(`\n${results.length - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
