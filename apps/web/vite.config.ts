/// <reference types="vitest/config" />
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";
import { devMounts } from "./scripts/dev-mounts.ts";

// The Lumiose website: every route is prerendered by `lumiose build` into dist/client, a static site.
// LUMIOSE_BASE serves it below a path (GitHub Pages: LUMIOSE_BASE=/lumiose/ lumiose build).
// In dev, devMounts serves the apps scripts/site.ts mounts below the site (the showcase apps, demos
// and benchmark UIs) from their builds.
export default defineConfig({
  base: process.env["LUMIOSE_BASE"] ?? "/",
  plugins: [devMounts(), lumiose({ mode: "static" })],
  test: { include: ["src/**/*.test.ts"] },
});
