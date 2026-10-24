import lumiose from "@lumiose/vite";
import { defineConfig, type Plugin } from "vite";

// Production builds of the benchmark app, one minified ES module each, which krausest's layout
// (frameworks/keyed/<name>/index.html) loads from dist/main.js:
// - default: src/App.stsx compiled by @lumiose/vite → dist/main.js (krausest `lumiose`);
// - `--mode keyed`: the same app with `key={row.id}` on its rows → dist-keyed/main.js (krausest
//   `lumiose-keyed`), so A/Bs also measure keyed reconciliation (TASK-555);
// - `--mode hand`: the hand-compiled reference (src/hand-compiled.js) → dist-hand/main.js
//   (krausest `lumiose-hand`), written from the compiler-runtime contract before the plugin existed.
export default defineConfig(({ mode }) => {
  const hand = mode === "hand";
  const keyed = mode === "keyed";
  return {
    plugins: hand ? [] : keyed ? [keyRows(), lumiose()] : [lumiose()],
    build: {
      target: "esnext",
      modulePreload: false,
      outDir: hand ? "dist-hand" : keyed ? "dist-keyed" : "dist",
      rollupOptions: {
        input: hand ? "src/hand-compiled.js" : "src/main.tsx",
        output: { entryFileNames: "main.js" },
      },
    },
  };
});

/** Adds `key={row.id}` to App.stsx's row element, so both variants share one source. */
function keyRows(): Plugin {
  const row = "<tr class={{ danger: selected() === id }}>";
  return {
    name: "jsfb-key-rows",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith("/App.stsx")) return null;
      if (!code.includes(row)) throw new Error(`keyed variant: \`${row}\` not found in ${id}`);
      return code.replace(row, "<tr key={row.id} class={{ danger: selected() === id }}>");
    },
  };
}
