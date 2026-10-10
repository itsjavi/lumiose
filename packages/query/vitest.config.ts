import { defineProject } from "vitest/config";

export default defineProject({
  // happy-dom tests run lumiose's browser build; node tests its server build.
  resolve: { conditions: ["browser"] },
  test: { name: "query", include: ["src/**/*.test.ts"] },
});
