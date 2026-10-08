/// <reference types="vitest/config" />
import lumen from "lumen/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumen()],
  // Browser e2e specs run with Playwright (`pnpm e2e`), not Vitest.
  test: { exclude: ["tests/**", "node_modules/**", "dist/**"] },
});
