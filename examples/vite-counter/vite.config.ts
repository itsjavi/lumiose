/// <reference types="vitest/config" />
import lumen from "lumen/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // Served below a path when LUMEN_BASE is set (the Lumen website: /lumen/examples/vite-counter/).
  base: process.env["LUMEN_BASE"] ?? "/",
  plugins: [lumen()],
  // Browser e2e specs run with Playwright (`pnpm e2e`), not Vitest.
  test: { exclude: ["tests/**", "node_modules/**", "dist/**"] },
});
