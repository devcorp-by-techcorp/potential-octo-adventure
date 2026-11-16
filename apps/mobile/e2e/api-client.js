// API client checks: credential modes, error mapping, single 401 callback, base URL rules.
// Transpiles the TypeScript modules that import nothing from react-native or expo; needs only `typescript`.
const ts = require('typescript'), fs = require('fs'), path = require('path'), os = require('os');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'api-'));
for (const f of ['apiBase', 'client', 'auth']) {
  const src = fs.readFileSync(path.join(__dirname, '../src/api', f + '.ts'), 'utf8');
  fs.writeFileSync(path.join(out, f + '.js'), ts.transpileModule(src, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText);
}
const { resolveApiBase } = require(path.join(out, 'apiBase.js'));
const { createApiClient, ApiError } = require(path.join(out, 'client.js'));
const auth = require(path.join(out, 'auth.js'));
const res = []; const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + x}`);

const json = (status, body, headers = {}) => ({ status, ok: status >= 200 && status < 300, headers: { get: (k) => headers[k] ?? null }, text: async () => (body === undefined ? '' : JSON.stringify(body)), json: async () => body });
function make(mode, respond = () => json(200, {}), extra = {}) {
  const calls = []; let unauth = 0;
  const fetch = async (url, init) => { calls.push({ url, init }); return respond(url, init); };
  const api = createApiClient({ base: 'https://api.test', mode, fetch, getToken: () => 'tok123', getCsrf: () => 'csrf456', onUnauthorized: () => { unauth++; }, ...extra });
  return { api, calls, unauthCount: () => unauth };
}
const hdr = (c, k) => { const h = c.init.headers || {}; const key = Object.keys(h).find((x) => x.toLowerCase() === k.toLowerCase()); return key ? h[key] : undefined; };

(async () => {
  {
    const t = make('cookie'); await t.api.request('GET', '/api/x'); await t.api.request('POST', '/api/x', { a: 1 });
    const [g, p] = t.calls;
    ok('cookie mode sends credentials include', g.init.credentials === 'include' && p.init.credentials === 'include');
    ok('cookie mode sends no Authorization header', hdr(g, 'Authorization') === undefined && hdr(p, 'Authorization') === undefined);
    ok('cookie GET sends no CSRF header', hdr(g, 'X-CSRF-Token') === undefined);
    ok('cookie POST sends X-CSRF-Token', hdr(p, 'X-CSRF-Token') === 'csrf456');
    ok('base is prefixed to the path', g.url === 'https://api.test/api/x');
    ok('POST body is JSON', p.init.body === '{"a":1}' && hdr(p, 'Content-Type') === 'application/json');
  }
  {
    const t = make('bearer'); await t.api.request('GET', '/api/x'); await t.api.request('POST', '/api/x', {});
    ok('bearer mode sends Authorization Bearer', t.calls.every((c) => hdr(c, 'Authorization') === 'Bearer tok123'));
    ok('bearer mode omits credentials include', t.calls.every((c) => c.init.credentials !== 'include'));
    ok('bearer mode sends no CSRF header', t.calls.every((c) => hdr(c, 'X-CSRF-Token') === undefined));
  }
  for (const [status, kind] of [[401, 'unauthorized'], [403, 'forbidden'], [404, 'not_found'], [409, 'conflict'], [422, 'invalid'], [429, 'rate_limited'], [503, 'unavailable'], [500, 'other']]) {
    const t = make('cookie', () => json(status, { detail: `msg ${status}` }));
    let err; try { await t.api.request('GET', '/x'); } catch (e) { err = e; }
    ok(`status ${status} maps to ${kind} with detail message`, err instanceof ApiError && err.status === status && err.kind === kind && err.message === `msg ${status}`, String(err && err.message));
  }
  {
    const t = make('cookie', () => { throw new TypeError('Failed to fetch'); });
    let err; try { await t.api.request('GET', '/x'); } catch (e) { err = e; }
    ok('rejected fetch gives ApiError status 0 unavailable', err instanceof ApiError && err.status === 0 && err.kind === 'unavailable');
  }
  {
    const t = make('cookie', () => json(401, { detail: 'expired' }));
    await Promise.all([1, 2, 3].map(() => t.api.request('GET', '/x').catch(() => {})));
    ok('three concurrent 401s call onUnauthorized once', t.unauthCount() === 1, String(t.unauthCount()));
    t.api.resetUnauthorized(); await t.api.request('GET', '/x').catch(() => {});
    ok('after resetUnauthorized a new 401 calls it again', t.unauthCount() === 2, String(t.unauthCount()));
  }
  {
    const t = make('cookie', () => json(204, undefined));
    ok('204 resolves undefined', (await t.api.request('POST', '/x', {})) === undefined);
  }
  // apiBase rules
  const msg = "EXPO_PUBLIC_API_URL must be set to the backend's HTTPS origin";
  const thr = (...a) => { try { resolveApiBase(...a); return null; } catch (e) { return e.message; } };
  ok('native with no env throws the exact message', thr('ios', undefined, false) === msg);
  ok('native with http env and not dev throws', thr('ios', 'http://x', false) === msg);
  ok('native with http env in dev returns it', resolveApiBase('ios', 'http://x', true) === 'http://x');
  ok('native with https env returns it', resolveApiBase('android', 'https://api.example.com', false) === 'https://api.example.com');
  ok('native in dev with no env throws', thr('android', undefined, true) === msg);
  ok('web with no env is same origin', resolveApiBase('web', undefined, false) === '');
  ok('web with env returns it', resolveApiBase('web', 'https://a.b', false) === 'https://a.b');

  // auth endpoints
  const idn = { id: '1', email: 'a@b.c', name: 'A' };
  {
    const t = make('cookie', () => json(200, { identity: idn, csrf_token: 'c1', expires_at: 'E', expires_in_seconds: 5 }));
    const s = await auth.signInRequest(t.api, 'cookie', 'staff', 'a@b.c', 'pw');
    ok('staff cookie sign-in path and mapping', t.calls[0].url.endsWith('/api/auth/login') && s.csrfToken === 'c1' && s.expiresAt === 'E' && s.token === undefined && s.identity.id === '1');
    ok('sign-in body has email and password', t.calls[0].init.body === '{"email":"a@b.c","password":"pw"}');
  }
  {
    const t = make('bearer', () => json(200, { identity: idn, token: 'T', expires_at: 'E', expires_in_seconds: 5 }));
    const s = await auth.signInRequest(t.api, 'bearer', 'client', 'a@b.c', 'pw');
    ok('client bearer sign-in path and token', t.calls[0].url.endsWith('/api/auth/client/token') && s.token === 'T' && s.csrfToken === null);
    await auth.signInRequest(t.api, 'cookie', 'client', 'a', 'b');
    ok('client cookie sign-in path', t.calls[1].url.endsWith('/api/auth/client/login'));
    await auth.signInRequest(t.api, 'bearer', 'staff', 'a', 'b');
    ok('staff bearer sign-in path', t.calls[2].url.endsWith('/api/auth/token'));
  }
  {
    const t = make('bearer', () => json(200, { identity: idn, csrf_token: null, expires_at: 'E', expires_in_seconds: 5 }));
    const s = await auth.readSession(t.api, 'client'); await auth.readSession(t.api, 'staff');
    ok('session paths per role', t.calls[0].url.endsWith('/api/auth/client/session') && t.calls[1].url.endsWith('/api/auth/session') && s.csrfToken === null);
  }
  {
    const t = make('cookie', () => json(204, undefined));
    await auth.signOutRequest(t.api, 'staff'); await auth.signOutRequest(t.api, 'client');
    ok('logout paths per role', t.calls[0].url.endsWith('/api/auth/logout') && t.calls[1].url.endsWith('/api/auth/client/logout'));
    ok('staff logout has no body, client logout sends {}', t.calls[0].init.body === undefined && t.calls[1].init.body === '{}');
    ok('logout uses POST', t.calls.every((c) => c.init.method === 'POST'));
  }

  {
    const t = make('cookie', () => json(401, { detail: 'Invalid credentials' }));
    let err; try { await auth.signInRequest(t.api, 'cookie', 'staff', 'a', 'bad'); } catch (e) { err = e; }
    let err2; try { await auth.signInRequest(t.api, 'bearer', 'client', 'a', 'bad'); } catch (e) { err2 = e; }
    ok('failed sign-in throws unauthorized ApiError with backend message', err instanceof ApiError && err.kind === 'unauthorized' && err.message === 'Invalid credentials' && err2 instanceof ApiError && err2.kind === 'unauthorized');
    ok('failed sign-in does not call onUnauthorized', t.unauthCount() === 0, String(t.unauthCount()));
    await t.api.request('GET', '/x').catch(() => {});
    ok('later ordinary 401 after failed sign-in calls onUnauthorized once', t.unauthCount() === 1, String(t.unauthCount()));
  }
  {
    const t = make('cookie', () => json(401, { detail: 'No session' }));
    let err; try { await auth.readSession(t.api, 'staff', { skipUnauthorized: true }); } catch (e) { err = e; }
    ok('readSession with skipUnauthorized throws unauthorized and never calls onUnauthorized', err instanceof ApiError && err.kind === 'unauthorized' && t.unauthCount() === 0, String(t.unauthCount()));
    await t.api.request('GET', '/x').catch(() => {});
    ok('a skipped session 401 does not arm the latch', t.unauthCount() === 1, String(t.unauthCount()));
  }

  {
    // A request that never answers rejects as "unavailable" once its signal aborts (sign-out budget).
    const hang = (url, init) => new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    const t = make('cookie', hang);
    const controller = new AbortController();
    const pending = auth.signOutRequest(t.api, 'staff', { skipUnauthorized: true, signal: controller.signal }).then(() => 'resolved', (e) => e);
    ok('the signal is passed to fetch', t.calls[0]?.init.signal === controller.signal);
    controller.abort();
    const err = await pending;
    ok('an aborted request rejects as unavailable', err instanceof ApiError && err.kind === 'unavailable', String(err));
  }

  console.log(res.join('\n')); const bad = res.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${res.length - bad} passed, ${bad} failed`); fs.rmSync(out, { recursive: true, force: true }); process.exit(bad ? 1 : 0);
})();
