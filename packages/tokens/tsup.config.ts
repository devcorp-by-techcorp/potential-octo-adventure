import { defineConfig } from "tsup";

// Two entries → two platform bundles. Metro resolves `index.native.js`; Vite/Node
// resolve `index.js` (the default). React (+ its JSX runtime) and react-native stay
// external — they are peers supplied by the consuming app, never bundled here.
export default defineConfig({
  entry: ["src/index.ts", "src/index.native.ts"],
  format: ["esm"],
  target: "es2020",
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  outDir: "dist",
  external: ["react", "react-dom", "react/jsx-runtime", "react-native"],
});
