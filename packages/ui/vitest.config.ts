import lumiose from "@lumiose/vite";
import { defineProject } from "vitest/config";

// `lumiose()` compiles the components; tests in a DOM environment (`// @vitest-environment
// happy-dom`) get lumiose's browser build, the others its server build. The keyboard, focus and axe
// checks need a real browser: examples/ui-e2e runs them with Playwright.
export default defineProject({
  plugins: [lumiose()],
  test: { name: "ui", include: ["src/**/*.test.{ts,tsx}"] },
});
