/// <reference types="vitest/config" />
import lumen from "lumen/vite";
import { defineConfig } from "vite";

// A client-rendered SPA: every route renders in the browser, inside the persistent root layout,
// and `lumen build` emits static files only (no dist/server). The COOP/COEP headers make pages
// cross-origin isolated (SharedArrayBuffer for the audio engine): `lumen({ headers })` sends them
// in `lumen dev` and `lumen preview`, and writes them to dist/client/_headers for static hosts.
export default defineConfig({
  // Served below a path when LUMEN_BASE is set (the Lumen website: /lumen/examples/spa-chiptune/).
  base: process.env["LUMEN_BASE"] ?? "/",
  plugins: [
    lumen({
      mode: "spa",
      ssr: false,
      csp: "strict",
      headers: {
        "cross-origin-opener-policy": "same-origin",
        "cross-origin-embedder-policy": "require-corp",
      },
    }),
  ],
  // GitHub Pages cannot send COOP/COEP: the site build (scripts/site.ts, which sets LUMEN_BASE)
  // turns on the cross-origin-isolation service worker (src/isolation.ts, public/coi-sw.js).
  // LUMEN_COI_SW=1 or 0 forces it on or off.
  define: {
    "import.meta.env.LUMEN_COI_SW": JSON.stringify(
      (process.env["LUMEN_COI_SW"] ?? (process.env["LUMEN_BASE"] ? "1" : "0")) === "1",
    ),
  },
  // The AudioWorklet module is loaded with `?worker&url`: an ES module bundle of its own.
  worker: { format: "es" },
  // Unit tests run in a DOM environment; browser e2e specs run with Playwright instead.
  test: { include: ["src/**/*.test.ts"], environment: "happy-dom" },
});
