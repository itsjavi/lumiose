/// <reference types="vitest/config" />
import lumen from "lumen/vite";
import { defineConfig } from "vite";

// A client-rendered SPA: every route renders in the browser, inside the persistent root layout,
// and `lumen build` emits static shells. src/middleware.ts adds the COOP/COEP headers to pages.
export default defineConfig(({ mode }) => ({
  plugins: [lumen({ mode: "spa", ssr: false })],
  // The AudioWorklet module is loaded with `?worker&url`: an ES module bundle of its own.
  worker: { format: "es" },
  // Unit tests need the browser build of `lumen` (reactive computeds), which takes both the
  // `browser` condition and a DOM environment. Browser e2e specs run with Playwright instead.
  resolve: mode === "test" ? { conditions: ["browser"] } : {},
  test: { include: ["src/**/*.test.ts"], environment: "happy-dom" },
}));
