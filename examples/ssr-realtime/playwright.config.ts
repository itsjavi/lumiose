import { defineConfig, devices } from "@playwright/test";

// End-to-end tests of server.ts: the production build (@lumiose/adapter-node) and dev
// (`--dev`, createDevHandler()), with the chat's WebSockets on the same server in both.
const PORT = 5198;
const DEV = 5199;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: [
    {
      command: "pnpm build && node server.ts",
      url: `http://127.0.0.1:${PORT}`,
      timeout: 120_000,
      env: { HOST: "127.0.0.1", PORT: String(PORT) },
    },
    {
      command: "node server.ts --dev",
      url: `http://127.0.0.1:${DEV}`,
      timeout: 60_000,
      env: { HOST: "127.0.0.1", PORT: String(DEV) },
    },
  ],
  projects: [
    {
      name: "build",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
    },
    { name: "dev", use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${DEV}` } },
  ],
});
