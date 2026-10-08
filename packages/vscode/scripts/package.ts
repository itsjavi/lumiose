// Packages a platform-specific .vsix (TASK-51): builds the extension and the bundled language
// server with the target's native compiler (scripts/build.ts), then runs `vsce package --target`.
// The native binary makes the package platform-specific, so each target is packaged on (or with a
// binary built for) its platform; see README.md.
//
//   node scripts/package.ts [--target <vsce target>]   → lumen-vscode-<target>.vsix

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hostTarget, parseTarget } from "./targets.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = parseTarget(process.argv.slice(2)) ?? hostTarget();
const run = (command: string, args: string[]) =>
  execFileSync(command, args, { cwd: root, stdio: "inherit" });

run(process.execPath, ["scripts/build.ts", "--target", target]);
run("pnpm", [
  "exec",
  "vsce",
  "package",
  "--no-dependencies",
  "--allow-missing-repository",
  "--skip-license",
  "--target",
  target,
  "--out",
  `lumen-vscode-${target}.vsix`,
]);
