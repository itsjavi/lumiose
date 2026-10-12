import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "adapter-cloudflare", include: ["src/**/*.test.ts"], testTimeout: 60_000 },
});
