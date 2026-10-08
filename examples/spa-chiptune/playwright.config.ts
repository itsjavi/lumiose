import { defineConfig, devices } from "@playwright/test";

// The same tests run against `vite` (dev) and `vite build` + `vite preview`.
const DEV = 5195;
const PREVIEW = 5196;

const chrome = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1440, height: 900 },
  // Headless Chromium has no audio device: let the AudioContext start without a gesture prompt.
  launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
};

export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  webServer: [
    { command: `vite --port ${DEV} --strictPort`, port: DEV },
    { command: `vite build && vite preview --port ${PREVIEW} --strictPort`, port: PREVIEW },
  ],
  projects: [
    { name: "dev", use: { ...chrome, baseURL: `http://localhost:${DEV}` } },
    { name: "preview", use: { ...chrome, baseURL: `http://localhost:${PREVIEW}` } },
  ],
});
