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
    command:
      "node scripts/playground-assets.ts && " +
      "LUMIOSE_BASE=/lumiose/ pnpm exec lumiose build && rm -rf .lumiose/e2e && mkdir -p .lumiose/e2e && " +
      "cp -R dist/client .lumiose/e2e/base && pnpm exec lumiose build && " +
      // The redirects from the old /examples/… URLs, as scripts/site.ts writes them (TASK-215).
      "node ../../scripts/site.ts redirects --out apps/web/dist/client --base / && " +
      "node ../../scripts/site.ts redirects --out apps/web/.lumiose/e2e/base --base /lumiose/ && " +
      `node e2e/serve.ts ${PORT} /=dist/client /lumiose/=.lumiose/e2e/base`,
    port: PORT,
    timeout: 300_000,
  },
  use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
});
