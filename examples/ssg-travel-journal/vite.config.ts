/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import lumen from "lumen/vite";
import { defineConfig } from "vite";
import { postFrontmatter } from "./src/frontmatter.ts";

export default defineConfig({
  // Every route is prerendered by `lumen build` ("static" is also the default). Page navigations
  // are cross-document View Transitions; links prefetch on hover (the `prefetch` default).
  // The posts are `.md` imports; the hook validates each one's frontmatter at build time.
  plugins: [
    lumen({
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
