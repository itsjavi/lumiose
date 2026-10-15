/// <reference types="vitest/config" />
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose({ mode: "server" })],
  // The browser tests run with Playwright (`pnpm test:e2e`), not Vitest.
  test: { include: [], passWithNoTests: true },
});
