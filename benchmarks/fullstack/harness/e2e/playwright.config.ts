// The conformance suite runs against an already running production server (the harness starts it):
//   BENCH_BASE_URL=http://127.0.0.1:4102 pnpm --filter @bench/harness conformance -- --only react-router
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  outputDir: "../.local/e2e-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.BENCH_BASE_URL ?? "http://127.0.0.1:4101",
  },
});
