import { defineConfig, devices } from "@playwright/test";

// End-to-end tests of the static build, served as plain files (e2e/serve.ts): the site at `/`, and
// a second build with `LUMIOSE_BASE=/lumiose/` at `/lumiose/`, as GitHub Pages serves a project site.
const PORT = 5194;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: {
    command:
      "LUMIOSE_BASE=/lumiose/ pnpm exec lumiose build && rm -rf .lumiose/e2e && mkdir -p .lumiose/e2e && " +
      "cp -R dist/client .lumiose/e2e/base && pnpm exec lumiose build && " +
      `node e2e/serve.ts ${PORT} /=dist/client /lumiose/=.lumiose/e2e/base`,
    port: PORT,
    timeout: 120_000,
  },
  use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
});
