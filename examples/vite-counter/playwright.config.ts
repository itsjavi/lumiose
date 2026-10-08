import { defineConfig, devices } from "@playwright/test";

// The same tests run against `vite` (dev, with HMR) and `vite build` + `vite preview`.
const DEV = 5181;
const PREVIEW = 5182;

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
