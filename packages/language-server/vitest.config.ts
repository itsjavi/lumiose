import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "language-server", include: ["src/**/*.test.ts"], testTimeout: 30_000 },
});
