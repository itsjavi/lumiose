/// <reference types="vitest/config" />
import lumen from "lumen/vite";
import { defineConfig } from "vite";

// The playground is part of the website, served below it at /playground/. LUMEN_BASE is the site's
// base, as for apps/web (GitHub Pages: LUMEN_BASE=/lumen/ serves the playground at
// /lumen/playground/). The page is prerendered; the playground itself is a client-only island.
const site = process.env["LUMEN_BASE"] ?? "/";

export default defineConfig({
  base: `${site.endsWith("/") ? site : `${site}/`}playground/`,
  plugins: [lumen({ mode: "static" })],
  test: { include: ["src/**/*.test.ts"] },
});
