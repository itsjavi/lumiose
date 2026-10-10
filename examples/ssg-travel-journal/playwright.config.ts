import { defineConfig, devices } from "@playwright/test";

// End-to-end tests of the static build: `lumiose build`, then `serve.ts` serves dist/client as plain
// files (no Lumiose code runs at request time).
const PORT = 5193;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: {
    command: "pnpm exec lumiose build && node serve.ts",
    port: PORT,
    timeout: 60_000,
    env: { HOST: "127.0.0.1", PORT: String(PORT) },
  },
  use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
});
