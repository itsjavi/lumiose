import { defineConfig } from "vitest/config";

// Unit tests only: the showcase specs run in browsers with Playwright (`pnpm test:e2e`).
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
