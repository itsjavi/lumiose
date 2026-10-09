/// <reference types="vitest/config" />
import lumen from "lumen/vite";
import { defineConfig } from "vite";

// A client-rendered SPA: every route renders in the browser inside the persistent root layout, and
// `lumen build` emits static shells. Audio renders offline in a module Web Worker (the vendored
// gbapu engine), so no cross-origin isolation is needed.
export default defineConfig({
  // `md: true` lets the Learn section render docs/composing.md as a page.
  plugins: [lumen({ mode: "spa", ssr: false, md: true })],
  worker: { format: "es" },
  // Unit tests run the driver and the engine in Node; browser specs run with Playwright instead.
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
