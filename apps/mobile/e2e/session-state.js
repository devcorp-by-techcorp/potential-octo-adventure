// Session reducer checks. Transpiles the pure reducer (no react/react-native/expo); needs only `typescript`.
const ts = require('typescript'), fs = require('fs'), path = require('path'), os = require('os');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sess-'));
const src = fs.readFileSync(path.join(__dirname, '../src/state/sessionReducer.ts'), 'utf8');
fs.writeFileSync(path.join(out, 'sessionReducer.js'), ts.transpileModule(src, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText);
const { sessionReducer, initialSessionState } = require(path.join(out, 'sessionReducer.js'));
const res = []; const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + x}`);
const info = { identity: { id: 'u1', email: 'a@b.test', name: 'Ada' }, expiresAt: '2030-01-01T00:00:00Z', csrfToken: null };
const S = (s, e) => sessionReducer(s, e);

ok('initial state is restoring with no identity', initialSessionState.status === 'restoring' && initialSessionState.identity === null && initialSessionState.message === null);
{
  const s = S(initialSessionState, { type: 'restored', role: 'staff', info });
  ok('restored staff -> status staff with identity', s.status === 'staff' && s.identity === info.identity && s.message === null);
  ok('restored client -> status client', S(initialSessionState, { type: 'restored', role: 'client', info }).status === 'client');
}
{
  const s = S(S(initialSessionState, { type: 'restored', role: 'staff', info }), { type: 'restore-failed-unauthorized' });
  ok('restore-failed-unauthorized -> signed-out, message null, identity cleared', s.status === 'signed-out' && s.message === null && s.identity === null);
}
{
  const signed = S(initialSessionState, { type: 'restored', role: 'client', info });
  const s = S(signed, { type: 'restore-failed-unavailable' });
  ok('restore-failed-unavailable -> unavailable', s.status === 'unavailable');
  ok('unavailable keeps identity and remembered role', s.identity === info.identity && s.role === 'client');
}
{
  const m = 'Your session has expired. Please sign in again.';
  const s = S(S(initialSessionState, { type: 'signed-in', role: 'staff', info }), { type: 'signed-out', message: m });
  ok('signed-out(message) -> signed-out carrying the message', s.status === 'signed-out' && s.message === m && s.identity === null);
  const t = S(s, { type: 'signed-out' });
  ok('signed-out() clears the message', t.status === 'signed-out' && t.message === null);
  const u = S(s, { type: 'signed-in', role: 'client', info });
  ok('signed-in -> client and clears the message', u.status === 'client' && u.message === null && u.identity === info.identity);
}
ok('unknown event leaves state unchanged', S(initialSessionState, { type: 'nope' }) === initialSessionState);

console.log(res.join('\n')); const bad = res.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${res.length - bad} passed, ${bad} failed`); fs.rmSync(out, { recursive: true, force: true }); process.exit(bad ? 1 : 0);
