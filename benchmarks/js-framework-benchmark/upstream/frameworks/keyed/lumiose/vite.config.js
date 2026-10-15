import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

// One minified ES module, dist/main.js, which index.html loads.
export default defineConfig({
  plugins: [lumiose()],
  build: {
    target: "esnext",
    modulePreload: false,
    rollupOptions: {
      input: "src/main.tsx",
      output: { entryFileNames: "main.js" },
    },
  },
});
