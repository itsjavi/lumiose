import { defineConfig, devices } from "@playwright/test";

// Smoke tests of the production build (`lumiose build`, then `node server.ts` on @lumiose/adapter-node)
// and the dev server's island hot swap (`lumiose dev`), each on a freshly seeded database of its own.
const PORT = 5191;
const DEV_PORT = 5189;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: [
    {
      command: "node src/server/seed.server.ts && pnpm exec lumiose build && node server.ts",
      port: PORT,
      timeout: 60_000,
      env: {
        BOOKSHELF_DB: "data/e2e.db",
        BOOKSHELF_SLOW_MS: "300",
        LUMIOSE_SECRET: "bookshelf-e2e-only-secret-of-32-bytes+",
        HOST: "127.0.0.1",
        PORT: String(PORT),
      },
    },
    {
      command: `node src/server/seed.server.ts && pnpm exec lumiose dev --port ${DEV_PORT} --host 127.0.0.1`,
      port: DEV_PORT,
      timeout: 60_000,
      env: { BOOKSHELF_DB: "data/e2e-dev.db", BOOKSHELF_SLOW_MS: "0" },
    },
  ],
  projects: [
    {
      name: "build",
      testMatch: "*.e2e.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
    },
    {
      name: "dev",
      testMatch: "*.dev.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${DEV_PORT}` },
    },
  ],
});
