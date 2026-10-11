import { defineConfig, devices } from "@playwright/test";

// End-to-end tests of the static build, served as plain files (e2e/serve.ts): the site at `/`, and
// a second build with `LUMIOSE_BASE=/lumiose/` at `/lumiose/`, as GitHub Pages serves a project site.
// The playground's WebAssembly compiler is built first (scripts/playground-assets.ts).
const PORT = 5194;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: {
    // Both builds are served from copies in .lumiose/e2e, so a concurrent `lumiose build` (such as
    // scripts/site.ts) cannot replace dist/client under the running tests.
    command:
      "node scripts/playground-assets.ts && " +
      "LUMIOSE_BASE=/lumiose/ pnpm exec lumiose build && rm -rf .lumiose/e2e && mkdir -p .lumiose/e2e && " +
      "cp -R dist/client .lumiose/e2e/base && pnpm exec lumiose build && cp -R dist/client .lumiose/e2e/root && " +
      // The redirects from the old /examples/… URLs, as scripts/site.ts writes them (TASK-215).
      "node ../../scripts/site.ts redirects --out apps/web/.lumiose/e2e/root --base / && " +
      "node ../../scripts/site.ts redirects --out apps/web/.lumiose/e2e/base --base /lumiose/ && " +
      `node e2e/serve.ts ${PORT} /=.lumiose/e2e/root /lumiose/=.lumiose/e2e/base`,
    port: PORT,
    timeout: 300_000,
    // Locally, a running `node e2e/serve.ts 5194 …` is reused (the build takes a while).
    reuseExistingServer: !process.env["CI"],
  },
  use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
});
