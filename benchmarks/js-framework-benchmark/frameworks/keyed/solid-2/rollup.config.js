// krausest's solid entry build (rollup + babel, IIFE, terser). Solid 2 compiles with
// @solidjs/babel-plugin, which replaces babel-preset-solid and has the Solid 2 defaults built in
// (babel-preset-solid stopped at 2.0.0-rc.2, whose output no longer matches the rc.14 runtime).
import resolve from "@rollup/plugin-node-resolve";
import { babel } from "@rollup/plugin-babel";
import terser from "@rollup/plugin-terser";

const TERSER_OPTIONS = {
  module: true,
  compress: { passes: 3 },
  mangle: true,
};

export default {
  input: "src/main.jsx",
  output: { file: "dist/main.js", format: "iife" },
  plugins: [
    babel({
      babelHelpers: "bundled",
      exclude: "node_modules/**",
      plugins: [["@solidjs/babel-plugin", { omitNestedClosingTags: true }]],
    }),
    resolve({ extensions: [".js", ".jsx"] }),
    process.env.production && terser(TERSER_OPTIONS),
  ].filter(Boolean),
};
