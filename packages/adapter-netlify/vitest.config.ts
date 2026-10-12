import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "adapter-netlify", include: ["src/**/*.test.ts"], testTimeout: 60_000 },
});
