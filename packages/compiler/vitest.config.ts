import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "compiler", include: ["test/**/*.test.ts"] },
});
