import { defineConfig, devices } from "@playwright/test";

// The fixture under `lumiose dev` and as a production build (`lumiose build`, then `lumiose preview`), in
// Chromium (Navigation API; one spec also runs the History API fallback).
const DEV = 5197;
const PREVIEW = 5198;

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
    { name: "dev", use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEV}` } },
    {
      name: "build",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PREVIEW}` },
    },
  ],
});
