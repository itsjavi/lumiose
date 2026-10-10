/// <reference types="vitest/config" />
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // Served below a path when LUMIOSE_BASE is set (the Lumiose website: /lumiose/examples/vite-counter/).
  base: process.env["LUMIOSE_BASE"] ?? "/",
  plugins: [lumiose()],
  // Browser e2e specs run with Playwright (`pnpm e2e`), not Vitest.
  test: { exclude: ["tests/**", "node_modules/**", "dist/**"] },
});
