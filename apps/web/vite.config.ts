/// <reference types="vitest/config" />
import lumiose from "lumiose/vite";
import { defineConfig } from "vite";

// The Lumiose website: every route is prerendered by `lumiose build` into dist/client, a static site.
// LUMIOSE_BASE serves it below a path (GitHub Pages: LUMIOSE_BASE=/lumiose/ lumiose build).
export default defineConfig({
  base: process.env["LUMIOSE_BASE"] ?? "/",
  plugins: [lumiose({ mode: "static" })],
  test: { include: ["src/**/*.test.ts"] },
});
