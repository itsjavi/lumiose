import { defineConfig, devices } from "@playwright/test";

// The fixture under `lumiose dev` and as a production build served by `lumiose preview`
// (@lumiose/adapter-node), in Chromium. Reduced motion turns the example styling's fades off, so
// axe never samples colours halfway through one.
// UI_E2E_PORT moves both servers (to it and the next port), so two checkouts can run the suite at
// once.
const DEV = Number(process.env.UI_E2E_PORT ?? 5243);
const PREVIEW = DEV + 1;
const reducedMotion = "reduce";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: [
    {
      command: `pnpm exec lumiose dev --port ${DEV}`,
      port: DEV,
      timeout: 60_000,
    },
    {
      command: `pnpm exec lumiose build && pnpm exec lumiose preview --port ${PREVIEW}`,
      port: PREVIEW,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "dev",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEV}`, reducedMotion },
    },
    {
      name: "build",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PREVIEW}`, reducedMotion },
    },
  ],
});
