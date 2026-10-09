import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "eslint-plugin", include: ["src/**/*.test.ts"], testTimeout: 60_000 },
});
