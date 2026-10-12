import { defineConfig, devices } from "@playwright/test";

// End-to-end tests of the production build served by server.ts: @lumiose/adapter-node, with the
// chat's WebSockets on the same server.
const PORT = 5198;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: {
    command: "pnpm build && node server.ts",
    url: `http://127.0.0.1:${PORT}`,
    timeout: 120_000,
    env: { HOST: "127.0.0.1", PORT: String(PORT) },
  },
  use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
});
