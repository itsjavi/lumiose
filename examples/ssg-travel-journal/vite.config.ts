/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";
import { postFrontmatter } from "./src/frontmatter.ts";

export default defineConfig({
  // Served below a path when LUMIOSE_BASE is set (the Lumiose website: /lumiose/examples/ssg-travel-journal/).
  base: process.env["LUMIOSE_BASE"] ?? "/",
  // Every route is prerendered by `lumiose build` ("static" is also the default). Page navigations
  // are cross-document View Transitions; links prefetch on hover (the `prefetch` default).
  // The posts are `.md` imports; the hook validates each one's frontmatter at build time.
  plugins: [
    lumiose({
      mode: "static",
      viewTransitions: true,
      // A strict Content Security Policy: prerendered pages allow their inline scripts and styles
      // by hash (a <meta> policy), so the site needs no `'unsafe-inline'`.
      csp: "strict",
      md: {
        frontmatter: (data, { file }) => postFrontmatter(data, file, readFileSync(file, "utf8")),
      },
    }),
  ],
  // Unit tests of the content layer; the browser tests run with Playwright (`pnpm test:e2e`).
  test: { include: ["src/**/*.test.ts"] },
});
