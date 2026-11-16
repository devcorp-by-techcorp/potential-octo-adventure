// Builds the web export for the e2e suites. EXPO_PUBLIC_* values are inlined at build time, so a
// developer's apps/mobile/.env must not leak in: blank them and use the same-origin proxy.
const { spawnSync } = require('child_process'), path = require('path');
const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-e2e'], {
  cwd: path.resolve(__dirname, '..'), stdio: 'inherit', shell: process.platform === 'win32',
  env: { ...process.env, EXPO_PUBLIC_API_URL: '', EXPO_PUBLIC_WEB_URL: '' },
});
process.exit(r.status === null ? 1 : r.status);
