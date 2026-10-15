/// <reference types="vitest/config" />
import lumiose from "@lumiose/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Server-rendered pages styled four ways at once: style blocks, an imported global stylesheet
// (src/styles/app.css, which also loads Tailwind v4), a route-only stylesheet and a CSS module.
export default defineConfig({
  plugins: [tailwindcss(), lumiose({ mode: "server" })],
  // The browser tests run with Playwright (`pnpm test:e2e`), not Vitest.
  test: { include: [], passWithNoTests: true },
});
