// Packages a platform-specific .vsix (TASK-51): builds the extension and the bundled language
// server with the target's native compiler (scripts/build.ts), then runs `vsce package --target`.
// The native binary makes the package platform-specific, so each target is packaged on (or with a
// binary built for) its platform; see README.md. `--all` packages every target, which needs every
// compiler binary in packages/compiler (the release workflow downloads them, TASK-594).
//
//   node scripts/package.ts [--target <vsce target> | --all]   → lumiose-vscode-<target>.vsix

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hostTarget, NAPI_PLATFORMS, parseTarget, type Target } from "./targets.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const argv = process.argv.slice(2);
const targets = argv.includes("--all")
  ? (Object.keys(NAPI_PLATFORMS) as Target[])
  : [parseTarget(argv) ?? hostTarget()];
const run = (command: string, args: string[]) =>
  execFileSync(command, args, { cwd: root, stdio: "inherit" });

for (const target of targets) {
  run(process.execPath, ["scripts/build.ts", "--target", target]);
  run("pnpm", [
    "exec",
    "vsce",
    "package",
    "--no-dependencies",
    "--target",
    target,
    "--out",
    `lumiose-vscode-${target}.vsix`,
  ]);
}
