// Bundles the extension (and vscode-languageclient) into one CommonJS file for the extension host.
import { rm } from "node:fs/promises";
import { build } from "rolldown";

const root = new URL("../", import.meta.url);
await rm(new URL("dist/", root), { recursive: true, force: true });
await build({
  cwd: root.pathname,
  input: "src/extension.ts",
  platform: "node",
  external: ["vscode"],
  output: { file: "dist/extension.cjs", format: "cjs", minify: true, sourcemap: true },
  logLevel: "warn",
});
