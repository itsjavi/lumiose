import { defineConfig, devices } from "@playwright/test";

// The fixture under `lumiose dev` and as a production build served by `lumiose preview`
// (@lumiose/adapter-node), in Chromium. Reduced motion turns the example styling's fades off, so
// axe never samples colours halfway through one.
// UI_E2E_PORT moves both servers (to it and the next port), so two checkouts can run the suite at
// once.
// UI_E2E_BROWSERS=firefox,webkit adds those browsers against the production build (TASK-361), as
// `pnpm test:e2e:browsers` does locally and the ui-browsers workflow in CI. Tests that a browser
// cannot pass yet skip it with the reason (`skipIn` in e2e/browsers.ts, or a `test.skip` that names
// a task). CI runs them on Linux. On macOS, WebKit's Tab reaches only fields (the system's keyboard
// navigation setting), so run them remotely: UI_E2E_WS=ws://… points at Linux's from the
// Playwright Docker image (`playwright run-server`), which reach the servers here through
// `exposeNetwork`.
const DEV = Number(process.env.UI_E2E_PORT ?? 5243);
const PREVIEW = DEV + 1;
const reducedMotion = "reduce" as const;
const BROWSERS = {
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
} as const;
const browsers = (process.env.UI_E2E_BROWSERS ?? "")
  .split(",")
  .filter((name): name is keyof typeof BROWSERS => name in BROWSERS);

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
    ...browsers.map((name) => ({
      name,
      use: {
        ...BROWSERS[name],
        baseURL: `http://localhost:${PREVIEW}`,
        reducedMotion,
        ...(process.env.UI_E2E_WS
          ? { connectOptions: { wsEndpoint: process.env.UI_E2E_WS, exposeNetwork: "<loopback>" } }
          : {}),
      },
    })),
  ],
});
