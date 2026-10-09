import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "prettier-plugin", include: ["src/**/*.test.ts"], testTimeout: 60_000 },
});
