import assert from "node:assert/strict";
import { createRequire } from "node:module";
// Resolve TypeScript as the tokens package sees it, wherever the package manager placed it.
const ts = createRequire(new URL("../packages/tokens/package.json", import.meta.url))("typescript");
import { readFileSync } from "node:fs";

const canonical = readFileSync("packages/tokens/src/tokens.ts", "utf8");
const reference = readFileSync("_ds/packages/tokens/src/tokens.ts", "utf8");
if (canonical !== reference) throw new Error("Application tokens differ from authoritative _ds/packages/tokens/src/tokens.ts. Reconcile application adapters against _ds; do not overwrite the reference to hide drift. See docs/development/design-system-compliance-audit.md (DS-01).");

const referenceModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(reference, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString("base64")}`);
const web = await import("../packages/tokens/dist/index.js");
const native = await import("../packages/tokens/dist/index.native.js");
for (const bundle of [web, native]) {
  assert.deepEqual({ ...bundle.tokens, palette: referenceModule.palette, shadow: referenceModule.shadow }, referenceModule.tokens, "Non-adapted bundled tokens differ from source authority");
  for (const [key, value] of Object.entries(referenceModule.palette)) assert.deepEqual(bundle.palette[key], value);
  for (const theme of ["light", "dark"]) {
    assert.deepEqual(bundle.themeToCSSVars(bundle.themes[theme]), {
      ...referenceModule.themeToCSSVars(referenceModule.themes[theme]),
      ...Object.fromEntries(Object.entries(referenceModule.themes[theme].status).map(([key, value]) => [`--status-${key}`, value])),
    }, "Compatibility aliases must retain all reference values");
    for (const key of ["sm", "md", "lg"]) {
      assert.deepEqual(bundle.shadowToRN(key, theme), referenceModule.shadowToRN(key, theme));
      assert.equal(bundle.shadowToCSS(key, theme), referenceModule.shadowToCSS(key, theme));
    }
    assert.equal(bundle.shadowToCSS("gold", theme), referenceModule.shadowToCSS("gold", theme));
  }
}
const generated = readFileSync("packages/tokens/dist/css/index.css", "utf8");
for (const theme of ["light", "dark"]) {
  const selector = theme === "light" ? ':root,\n[data-theme="light"]' : '[data-theme="dark"]';
  const start = generated.indexOf(`${selector} {`);
  assert.ok(start >= 0, `Missing ${theme} CSS block`);
  const body = generated.slice(start, generated.indexOf("}", start));
  for (const [key, value] of Object.entries(web.themeToCSSVars(web.themes[theme]))) {
    assert.ok(body.includes(`  ${key}: ${value};`), `${theme} CSS drift: ${key}`);
  }
}
const runtime = readFileSync("web/src/index.css", "utf8");
const declarations = new Set([...generated.matchAll(/(--[\w-]+)\s*:/g), ...runtime.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
const uses = new Set([...runtime.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]));
const missing = [...uses].filter((name) => !declarations.has(name));
if (missing.length) throw new Error(`Undefined runtime CSS variables: ${missing.join(", ")}`);
for (const required of ["--font-editorial", "--space-s5", "--radius-xs", "--motion-fast", "--status-danger"]) {
  if (!generated.includes(`${required}:`)) throw new Error(`Generated token contract omits ${required}`);
}
console.log(`design-check: token mirrors match; ${uses.size} runtime variables resolve.`);
