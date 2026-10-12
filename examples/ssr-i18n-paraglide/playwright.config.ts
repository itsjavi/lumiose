import { defineConfig, devices } from "@playwright/test";

// End-to-end tests of the production build (`lumiose build`, then `node server.ts` on
// @lumiose/adapter-node). The browser asks for English unless a test says otherwise.
const PORT = 5213;

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
  use: { ...devices["Desktop Chrome"], locale: "en-US", baseURL: `http://127.0.0.1:${PORT}` },
});
