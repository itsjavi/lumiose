import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

// Production builds of the benchmark app, one minified ES module each, which krausest's layout
// (frameworks/keyed/<name>/index.html) loads from dist/main.js:
// - default: src/App.stsx compiled by lumiose/vite → dist/main.js (krausest `lumiose`);
// - `--mode hand`: the hand-compiled reference (src/hand-compiled.js) → dist-hand/main.js
//   (krausest `lumiose-hand`), written from the compiler-runtime contract before the plugin existed.
export default defineConfig(({ mode }) => {
  const hand = mode === "hand";
  return {
    plugins: hand ? [] : [lumiose()],
    build: {
      target: "esnext",
      modulePreload: false,
      outDir: hand ? "dist-hand" : "dist",
      rollupOptions: {
        input: hand ? "src/hand-compiled.js" : "src/main.tsx",
        output: { entryFileNames: "main.js" },
      },
    },
  };
});
