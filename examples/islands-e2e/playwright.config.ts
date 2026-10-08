import { defineConfig, devices } from "@playwright/test";

// The fixture's dev SSR server (Vite middleware mode), in Chromium.
const PORT = 5193;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: {
    command: "node server.ts",
    port: PORT,
    timeout: 60_000,
    env: { PORT: String(PORT) },
  },
  use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
});
