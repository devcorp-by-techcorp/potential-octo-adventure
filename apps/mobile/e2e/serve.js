// Shared static server for a web export: SPA fallback, and /api/* proxied to the backend so the
// app and the API share one origin (cookie sessions and CSRF behave as in production).
const http = require('http'), fs = require('fs'), path = require('path');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon' };

function createServer(root, backendUrl) {
  const target = backendUrl ? new URL(backendUrl) : null;
  return http.createServer((q, r) => {
    if (q.url.startsWith('/api/')) {
      if (!target) { r.writeHead(502); return r.end('no backend configured'); }
      const up = http.request({ host: target.hostname, port: target.port, path: q.url, method: q.method, headers: { ...q.headers, host: target.host } }, (res) => {
        r.writeHead(res.statusCode, res.headers); res.pipe(r);
      });
      up.on('error', () => { if (!r.headersSent) r.writeHead(502); r.end(); });
      return q.pipe(up);
    }
    let p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
    r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
  });
}

// Start a server on a free port. Resolves { base, close }.
function start(root, backendUrl, port = 0) {
  const srv = createServer(root, backendUrl);
  return new Promise((resolve) => srv.listen(port, '127.0.0.1', () => resolve({ base: 'http://127.0.0.1:' + srv.address().port, close: () => srv.close() })));
}

// For suites: use the server run.js started (APP_BASE_URL), or start one against APP_BACKEND_URL.
async function attach(root) {
  if (process.env.APP_BASE_URL) return { base: process.env.APP_BASE_URL, close: () => {} };
  return start(root, process.env.APP_BACKEND_URL);
}

module.exports = { createServer, start, attach };
