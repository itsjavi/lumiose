/// <reference types="vitest/config" />
import lumen from "lumen/vite";
import { defineConfig } from "vite";

// A client-rendered SPA: every route renders in the browser, inside the persistent root layout,
// and `lumen build` emits static shells. The COOP/COEP headers make pages cross-origin isolated:
// `lumen dev` and `lumen preview` (Vite's `preview.headers` default to these) send them with every
// response, static shells included; src/middleware.ts adds them to pages the server renders.
const isolated = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
};

export default defineConfig({
  plugins: [lumen({ mode: "spa", ssr: false })],
  server: { headers: isolated },
  // The AudioWorklet module is loaded with `?worker&url`: an ES module bundle of its own.
  worker: { format: "es" },
  // Unit tests run in a DOM environment; browser e2e specs run with Playwright instead.
  test: { include: ["src/**/*.test.ts"], environment: "happy-dom" },
});
