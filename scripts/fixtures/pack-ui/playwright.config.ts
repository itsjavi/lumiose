import { defineConfig, devices } from "@playwright/test";

// The packed @lumiose/ui in an app installed from tarballs (scripts/pack.ts --smoke, TASK-390):
// under `lumiose dev`, and built and served by `lumiose preview`.
const DEV = 5291;
const PREVIEW = 5292;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  workers: 1,
  reporter: "line",
  webServer: [
    { command: `npx lumiose dev --port ${DEV}`, port: DEV, timeout: 60_000 },
    {
      command: `npx lumiose build && npx lumiose preview --port ${PREVIEW}`,
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
