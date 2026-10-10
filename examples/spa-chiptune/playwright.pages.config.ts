import { defineConfig, devices } from "@playwright/test";

// The chiptune as GitHub Pages serves it: `pnpm build:site` (which sets LUMIOSE_BASE and so turns on
// the cross-origin-isolation service worker) and `pnpm preview:site`, which, like Pages, sends no
// COOP/COEP headers. Run with `pnpm test:e2e:pages` (it builds the whole site first).
const PORT = 5291;
const OUT = "dist/site-e2e";

export default defineConfig({
  testDir: "tests-pages",
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  webServer: {
    command: `pnpm --dir ../.. build:site --base /lumiose/ --out ${OUT} --skip-compiler && pnpm --dir ../.. preview:site --base /lumiose/ --out ${OUT} --port ${PORT}`,
    port: PORT,
    timeout: 600_000,
  },
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    baseURL: `http://localhost:${PORT}/lumiose/examples/spa-chiptune/`,
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  },
});
