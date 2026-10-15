import { defineConfig, devices } from "@playwright/test";

// The suites in each engine, against a production build (`vite build` + `vite preview`).
// Upstream scores Chrome and Firefox; WebKit is reported on its own.
const PORT = 5199;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  reporter: "list",
  webServer: {
    command: `vite build && vite preview --port ${PORT} --strictPort`,
    port: PORT,
    timeout: 120_000,
  },
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
