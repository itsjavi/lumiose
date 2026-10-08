/// <reference types="vitest/config" />
import lumen from "lumen/vite";
import { defineConfig } from "vite";

// The Lumen website: every route is prerendered by `lumen build` into dist/client, a static site.
// LUMEN_BASE serves it below a path (GitHub Pages: LUMEN_BASE=/lumen/ lumen build).
export default defineConfig({
  base: process.env["LUMEN_BASE"] ?? "/",
  plugins: [lumen({ mode: "static" })],
  test: { include: ["src/**/*.test.ts"] },
});
