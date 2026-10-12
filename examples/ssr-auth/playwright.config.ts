import { defineConfig, devices } from "@playwright/test";

// End-to-end tests of the production build (`lumiose build`, then `node server.ts` on
// @lumiose/adapter-node), on a fresh database of their own. Better Auth's rate limiter is on in
// production: the tests trust 127.0.0.1 as a proxy and give each test its own client address
// (X-Forwarded-For), as a proxy would, so they do not share its buckets.
const PORT = 5197;
const ORIGIN = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: {
    command:
      "node -e \"require('node:fs').rmSync('data/e2e.db', { force: true })\" && pnpm build && pnpm db:migrate && node server.ts",
    url: ORIGIN,
    timeout: 120_000,
    env: {
      DATABASE_URL: "file:./data/e2e.db",
      BETTER_AUTH_SECRET: "ssr-auth-e2e-only-secret-of-32-bytes",
      BETTER_AUTH_URL: ORIGIN,
      TRUSTED_PROXIES: "127.0.0.1",
      HOST: "127.0.0.1",
      PORT: String(PORT),
    },
  },
  use: { ...devices["Desktop Chrome"], baseURL: ORIGIN },
});
