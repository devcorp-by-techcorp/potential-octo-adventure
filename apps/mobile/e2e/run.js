// Runs the web-build suites against a real backend (backend/tests/app_server.py).
//   BROWSER_MONGODB_URI   MongoDB replica-set URI (required)
//   APP_TEST_PYTHON       Python with backend/requirements-dev.txt installed (default: python3).
//                         Locally: APP_TEST_PYTHON=backend/.venv/bin/python
// Ports are ephemeral. Expects the web export in dist-e2e (the e2e script builds it first).
const { spawn } = require('child_process');
const http = require('http'), net = require('net'), path = require('path');
const { start } = require('./serve');

const repo = path.resolve(__dirname, '../../..');
const dist = path.resolve(__dirname, '../dist-e2e');
const python = process.env.APP_TEST_PYTHON ? path.resolve(repo, process.env.APP_TEST_PYTHON) : 'python3';
if (!process.env.BROWSER_MONGODB_URI) { console.error('BROWSER_MONGODB_URI is required'); process.exit(2); }

const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const ready = (url, deadline) => new Promise((resolve, reject) => {
  const tick = () => http.get(url, (r) => { r.resume(); r.statusCode === 200 ? resolve() : retry(); }).on('error', retry);
  const retry = () => (Date.now() > deadline ? reject(new Error('backend did not become ready')) : setTimeout(tick, 300));
  tick();
});
const suite = (file, args, env) => new Promise((res) => spawn('node', [path.join(__dirname, file), ...args], { stdio: 'inherit', env }).on('exit', (c) => res(c)));

(async () => {
  let backend, web, failed = false;
  const stop = () => { if (backend && !backend.killed) backend.kill('SIGKILL'); if (web) web.close(); };
  process.on('SIGINT', () => { stop(); process.exit(130); });
  process.on('SIGTERM', () => { stop(); process.exit(143); });
  try {
    const backendPort = await freePort();
    const backendUrl = 'http://127.0.0.1:' + backendPort;
    web = await start(dist, backendUrl);
    backend = spawn(python, [path.join(repo, 'backend/tests/app_server.py')], {
      cwd: path.join(repo, 'backend'), stdio: 'inherit',
      env: { ...process.env, APP_TEST_ORIGIN: web.base, APP_TEST_BACKEND_PORT: String(backendPort) },
    });
    backend.on('exit', (c) => { if (c !== null && !backend.killed) { console.error('backend exited early with', c); process.exit(1); } });
    await ready(backendUrl + '/api/ready', Date.now() + 90000);
    const env = { ...process.env, APP_BASE_URL: web.base, APP_BACKEND_URL: backendUrl };
    const only = process.argv.slice(2); // optional suite names, e.g. `node e2e/run.js auth`
    for (const [file, args] of [['auth.js', []], ['screens.js', [dist]], ['kids.js', [dist]], ['studio.js', [dist]]].filter(([f]) => !only.length || only.includes(f.replace('.js', '')))) {
      console.log(`\n=== ${file} ===`);
      if ((await suite(file, args, env)) !== 0) { failed = true; console.error(`${file} failed`); }
    }
  } catch (e) { console.error(e.message); failed = true; }
  finally { stop(); }
  process.exit(failed ? 1 : 0);
})();
