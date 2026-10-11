/// <reference types="vitest/config" />
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

// The whole app is one SPA, prerendered at build time (decision-38): `lumiose build` writes an HTML
// file per page and per staticPaths() entry, and no dist/server.
export default defineConfig({
  plugins: [lumiose({ mode: "spa", prerender: true })],
  // The browser tests run with Playwright (`pnpm test:e2e`), not Vitest.
  test: { include: [], passWithNoTests: true },
});
