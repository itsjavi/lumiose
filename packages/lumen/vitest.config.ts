import { defineProject } from "vitest/config";

// DOM tests opt in per file with `// @vitest-environment happy-dom`.
export default defineProject({
  test: { name: "lumen", include: ["src/**/*.test.ts"] },
});
