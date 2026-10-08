import { defineConfig } from "vite";

// Production build of the benchmark app: one minified ES module at dist/main.js, which krausest's
// layout (frameworks/keyed/lumen/index.html) loads.
export default defineConfig({
  build: {
    target: "esnext",
    modulePreload: false,
    rollupOptions: {
      input: "src/main.js",
      output: { entryFileNames: "main.js" },
    },
  },
});
