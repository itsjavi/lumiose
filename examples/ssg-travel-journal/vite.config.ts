/// <reference types="vitest/config" />
import lumen from "lumen/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // Every route is prerendered by `lumen build` ("static" is also the default). Page navigations
  // are cross-document View Transitions; links prefetch on hover (the `prefetch` default).
  plugins: [lumen({ mode: "static", viewTransitions: true })],
  // Unit tests of the content layer; the browser tests run with Playwright (`pnpm test:e2e`).
  test: { include: ["src/**/*.test.ts"] },
});
