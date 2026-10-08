/// <reference types="vitest/config" />
import lumen from "lumen/vite";
import { defineConfig } from "vite";

// Cross-origin isolation enables SharedArrayBuffer, which the audio engine uses to publish the
// playing row, levels and scope samples to the UI without messages. Without it, it falls back to
// postMessage.
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig(({ mode }) => ({
  plugins: [lumen()],
  server: { headers: isolation },
  preview: { headers: isolation },
  // The AudioWorklet module is loaded with `?worker&url`: an ES module bundle of its own.
  worker: { format: "es" },
  // Unit tests need the browser build of `lumen` (reactive computeds), which takes both the
  // `browser` condition and a DOM environment. Browser e2e specs run with Playwright instead.
  resolve: mode === "test" ? { conditions: ["browser"] } : {},
  test: { include: ["src/**/*.test.ts"], environment: "happy-dom" },
}));
