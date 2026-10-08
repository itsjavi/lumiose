import { defineConfig, devices } from "@playwright/test";

// End-to-end tests of the static build, served as plain files (e2e/serve.ts): the site at `/`, and
// a second build with `LUMEN_BASE=/lumen/` at `/lumen/`, as GitHub Pages serves a project site.
const PORT = 5194;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: {
    command:
      "LUMEN_BASE=/lumen/ pnpm exec lumen build && rm -rf .lumen/e2e && mkdir -p .lumen/e2e && " +
      "cp -R dist/client .lumen/e2e/base && pnpm exec lumen build && " +
      `node e2e/serve.ts ${PORT} /=dist/client /lumen/=.lumen/e2e/base`,
    port: PORT,
    timeout: 120_000,
  },
  use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
});
