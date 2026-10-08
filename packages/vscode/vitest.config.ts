import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "vscode", include: ["test/**/*.test.ts"] },
});
