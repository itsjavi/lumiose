/// <reference types="vitest/config" />
import lumiose from "lumiose/vite";
import { defineConfig } from "vite";

// A client-rendered SPA: every route renders in the browser, inside the persistent root layout,
// and `lumiose build` emits static files only (no dist/server). The COOP/COEP headers make pages
// cross-origin isolated (SharedArrayBuffer for the audio engine): `lumiose({ headers })` sends them
// in `lumiose dev` and `lumiose preview`, and writes them to dist/client/_headers for static hosts.
export default defineConfig({
  // Served below a path when LUMIOSE_BASE is set (the Lumiose website: /lumiose/examples/spa-chiptune/).
  base: process.env["LUMIOSE_BASE"] ?? "/",
  plugins: [
    lumiose({
      mode: "spa",
      ssr: false,
      csp: "strict",
      headers: {
        "cross-origin-opener-policy": "same-origin",
        "cross-origin-embedder-policy": "require-corp",
      },
    }),
  ],
  // GitHub Pages cannot send COOP/COEP: the site build (scripts/site.ts, which sets LUMIOSE_BASE)
  // turns on the cross-origin-isolation service worker (src/isolation.ts, public/coi-sw.js).
  // LUMIOSE_COI_SW=1 or 0 forces it on or off.
  define: {
    "import.meta.env.LUMIOSE_COI_SW": JSON.stringify(
      (process.env["LUMIOSE_COI_SW"] ?? (process.env["LUMIOSE_BASE"] ? "1" : "0")) === "1",
    ),
  },
  // The AudioWorklet module is loaded with `?worker&url`: an ES module bundle of its own.
  worker: { format: "es" },
  // Unit tests run in a DOM environment; browser e2e specs run with Playwright instead.
  test: { include: ["src/**/*.test.ts"], environment: "happy-dom" },
});
