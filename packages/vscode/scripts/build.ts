// Builds what the .vsix ships (TASK-30, TASK-51):
// - dist/extension.cjs: the extension and vscode-languageclient, one CommonJS file for the host;
// - server/bin.mjs: @lumen/language-server and its runtime dependencies (vscode-languageserver,
//   vscode-css-languageservice, lumen/tooling, the @lumen/compiler loader), one ESM file that
//   VS Code's own Node.js runs, so a project needs neither the server nor Node ≥ 24;
// - server/compiler.<platform>.node: the native compiler for the target platform, which the
//   bundled loader requires next to bin.mjs. TypeScript 7 is not bundled: the server uses the
//   project's `typescript` (a native, platform-specific binary as well).
//
//   node scripts/build.ts [--target <vsce target>]   default: this machine's platform

import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "rolldown";
import { hostTarget, NAPI_PLATFORMS, parseTarget } from "./targets.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const compilerDir = fileURLToPath(new URL("../../compiler/", import.meta.url));
const serverDir = fileURLToPath(new URL("../server/", import.meta.url));
const target = parseTarget(process.argv.slice(2)) ?? hostTarget();

await Promise.all([
  rm(`${root}dist/`, { recursive: true, force: true }),
  rm(serverDir, { recursive: true, force: true }),
]);

await build({
  cwd: root,
  input: "src/extension.ts",
  platform: "node",
  external: ["vscode"],
  output: { file: "dist/extension.cjs", format: "cjs", minify: true, sourcemap: true },
  logLevel: "warn",
});

await build({
  cwd: fileURLToPath(new URL("../../language-server/", import.meta.url)),
  input: "src/bin.ts",
  platform: "node",
  // `lumen check` loads the project's Vite config (`import("vite")` in lumen/tooling); the server
  // never does, so Vite stays out of the bundle.
  external: ["vite"],
  // The ESM builds: the UMD builds of the vscode-* packages hide their requires from bundlers.
  resolve: { mainFields: ["module", "main"] },
  output: { file: `${serverDir}bin.mjs`, format: "esm", minify: true, sourcemap: true },
  logLevel: "warn",
  onLog(level, log, handler) {
    // @lumen/compiler is imported statically by the server and dynamically by lumen/tooling.
    if (log.code !== "INEFFECTIVE_DYNAMIC_IMPORT") handler(level, log);
  },
});

const binary = `compiler.${NAPI_PLATFORMS[target]}.node`;
const available = (await readdir(compilerDir)).filter((name) => name.endsWith(".node"));
if (!available.includes(binary)) {
  console.error(
    `packages/compiler/${binary} is missing for target ${target} (found: ${available.join(", ") || "none"}).\n` +
      `Build it on that platform with \`pnpm build:compiler\`, or pass --target for a platform whose binary exists.`,
  );
  process.exit(1);
}
await mkdir(serverDir, { recursive: true });
await copyFile(`${compilerDir}${binary}`, `${serverDir}${binary}`);
console.log(`Built dist/extension.cjs and server/ for ${target} (${binary}).`);
