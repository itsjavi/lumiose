// `stsx` CLI: `stsx typegen [root]` writes the shadow TSX that `tsc` checks `.stsx` files through
// (./typegen.ts). ./bin.ts runs it.

import { relative } from "node:path";
import { rootDirsHint, shadowLayout, syncShadows } from "./typegen.ts";

const USAGE = "Usage: stsx typegen [root]\n\nWrites the shadow TSX of every .stsx file for tsc.";

export function main(args: string[], log = console.log, error = console.error): number {
  const [command, root = ".", ...rest] = args;
  if (command === "--help" || command === "-h" || command === undefined) {
    log(USAGE);
    return command === undefined ? 1 : 0;
  }
  if (command !== "typegen" || rest.length > 0) {
    error(`Unknown command: ${args.join(" ")}\n\n${USAGE}`);
    return 1;
  }
  const layout = shadowLayout(root);
  const { written, removed } = syncShadows(layout);
  const dir = relative(process.cwd(), layout.dir) || ".";
  log(
    `stsx typegen: ${written} shadow(s) in ${dir}${removed > 0 ? `, ${removed} stale removed` : ""}`,
  );
  if (!layout.configured) {
    log(
      `Add the shadows to tsconfig.json's compilerOptions so that tsc finds them:\n  ${rootDirsHint(layout)}`,
    );
  }
  return 0;
}
