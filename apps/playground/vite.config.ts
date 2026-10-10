/// <reference types="vitest/config" />
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

// The playground is part of the website, served below it at /playground/. LUMIOSE_BASE is the site's
// base, as for apps/web (GitHub Pages: LUMIOSE_BASE=/lumiose/ serves the playground at
// /lumiose/playground/). The page is prerendered; the playground itself is a client-only island.
const site = process.env["LUMIOSE_BASE"] ?? "/";

export default defineConfig({
  base: `${site.endsWith("/") ? site : `${site}/`}playground/`,
  plugins: [lumiose({ mode: "static" })],
  test: { include: ["src/**/*.test.ts"] },
});
