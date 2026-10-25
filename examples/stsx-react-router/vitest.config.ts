import { defineProject } from "vitest/config";

// The smoke test builds the app with vite.config.ts; React Router's plugin is not for Vitest.
export default defineProject({
  test: { name: "stsx-react-router", exclude: ["node_modules/**", "build/**"] },
});
