import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from "node:module";
// Resolve TypeScript as the tokens package sees it, wherever the package manager placed it.
const ts = createRequire(new URL("../packages/tokens/package.json", import.meta.url))("typescript");

// Immutable pre-migration API oracle, independent of the compatibility implementation.
const historical = readFileSync(new URL('./fixtures/pre-c1-a-tokens.ts', import.meta.url), 'utf8');
const old = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(historical, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`);
for (const entry of ['index', 'index.native']) {
  const bundle = await import(`../packages/tokens/dist/${entry}.js`);
  for (const name of ['gold', 'sage']) {
    for (const [step, color] of Object.entries(old.palette[name])) {
      assert.equal(bundle.palette[name][step], color, `${entry}: ${name}.${step}`);
      assert.equal(bundle.tokens.palette[name][step], color);
    }
  }
  for (const key of ['sm', 'md', 'lg']) {
    assert.deepEqual(bundle.shadow[key], old.shadow[key]);
    assert.deepEqual(bundle.tokens.shadow[key], old.shadow[key]);
    assert.equal(bundle.shadowToCSS(key), old.shadowToCSS(key));
    for (const color of ['255,0,12', '1, 2, 3', 'var(--shadow-rgb)']) {
      assert.equal(bundle.shadowToCSS(key, color), old.shadowToCSS(key, color));
    }
    assert.deepEqual(bundle.shadowToRN(key), old.shadowToRN(key));
  }
}
console.log('token-compatibility: historical web/native palette, rollup, alpha and shadow helper contracts pass.');
