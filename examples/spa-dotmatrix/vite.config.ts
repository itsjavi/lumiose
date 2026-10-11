/// <reference types="vitest/config" />
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

// A prerendered SPA: `lumiose build` writes the real HTML of every route, which the browser hydrates
// inside the persistent root layout; later navigation is client-side. Browser-only work (storage,
// Web Audio, the render worker) starts after hydration or on a user gesture. Audio renders offline
// in a module Web Worker (the vendored gbapu engine), so no cross-origin isolation is needed.
export default defineConfig({
  // Served below a path when LUMIOSE_BASE is set (the Lumiose website: /lumiose/examples/spa-dotmatrix/).
  base: process.env["LUMIOSE_BASE"] ?? "/",
  // `md: true` lets the Learn section render docs/composing.md as a page.
  plugins: [lumiose({ mode: "spa", prerender: true, md: true })],
  worker: { format: "es" },
  // Unit tests run the driver and the engine in Node; browser specs run with Playwright instead.
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
