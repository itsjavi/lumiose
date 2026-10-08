import { defineConfig, devices } from "@playwright/test";

// The showcase specs run against `vite` (dev) and `vite build` + `vite preview` (production CSS,
// where Vite's minifier lowers `light-dark()` for its default targets).
const DEV = 5191;
const PREVIEW = 5192;

export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: [
    { command: `vite --port ${DEV} --strictPort`, port: DEV },
    { command: `vite build && vite preview --port ${PREVIEW} --strictPort`, port: PREVIEW },
  ],
  projects: [
    {
      name: "dev",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEV}` },
    },
    {
      name: "preview",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PREVIEW}` },
    },
  ],
});
