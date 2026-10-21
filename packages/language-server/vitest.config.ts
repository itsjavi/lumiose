import { defineProject } from "vitest/config";

// The hooks start and stop real TypeScript servers: they get the tests' time (TASK-510).
export default defineProject({
  test: {
    name: "language-server",
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
