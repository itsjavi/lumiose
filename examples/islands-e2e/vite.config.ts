/// <reference types="vitest/config" />
import lumen from "lumen/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumen()],
  // The browser tests run with Playwright (`pnpm test:e2e`), not Vitest.
  test: { include: [], passWithNoTests: true },
});
