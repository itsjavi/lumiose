import { fileURLToPath } from "node:url";
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

// The test page: src/main.ts runs the suites in the browser and leaves the results on `window`.
// `chai` resolves to the small subset the suites use (src/chai.ts), so the test files keep the
// upstream format (mocha globals, `import { expect } from "chai"`) without the dependencies.
export default defineConfig({
  plugins: [lumiose()],
  resolve: { alias: { chai: fileURLToPath(new URL("src/chai.ts", import.meta.url)) } },
  build: { target: "esnext", modulePreload: false },
});
