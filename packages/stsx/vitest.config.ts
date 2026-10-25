import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "stsx", include: ["src/**/*.test.ts"], testTimeout: 30_000 },
});
