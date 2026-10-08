import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "create", include: ["src/**/*.test.ts"], testTimeout: 120_000 },
});
