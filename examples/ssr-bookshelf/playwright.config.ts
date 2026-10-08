import { defineConfig, devices } from "@playwright/test";

// Smoke tests of the production build: `lumen build`, then `node server.ts` (@lumen/adapter-node)
// on a freshly seeded database of its own.
const PORT = 5191;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: {
    command: "node src/server/seed.server.ts && pnpm exec lumen build && node server.ts",
    port: PORT,
    timeout: 60_000,
    env: {
      BOOKSHELF_DB: "data/e2e.db",
      BOOKSHELF_SLOW_MS: "300",
      LUMEN_SECRET: "bookshelf-e2e-only",
      HOST: "127.0.0.1",
      PORT: String(PORT),
    },
  },
  use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
});
