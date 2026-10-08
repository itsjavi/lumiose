/// <reference types="vitest/config" />
import lumen from "lumen/vite";
import { defineConfig } from "vite";

// The whole app is one SPA, rendered on the server and hydrated; `src/routes/csr` opts out of SSR.
export default defineConfig({
  plugins: [lumen({ mode: "spa" })],
  // The browser tests run with Playwright (`pnpm test:e2e`), not Vitest.
  test: { include: [], passWithNoTests: true },
});
