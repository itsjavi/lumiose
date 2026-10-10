// Test helper (not published): links the workspace's Lumiose packages into a temporary project's
// node_modules, as an install would: `lumiose`, `@lumiose/vite`, `@lumiose/cli` and
// `@lumiose/compiler`.
import { mkdirSync, realpathSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packages = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** The workspace directory of the `lumiose` package. */
export const LUMIOSE_ROOT = realpathSync(join(packages, "lumiose"));

/** Links the Lumiose packages into `<dir>/node_modules`. */
export function linkLumiose(dir: string): void {
  mkdirSync(join(dir, "node_modules/@lumiose"), { recursive: true });
  symlinkSync(LUMIOSE_ROOT, join(dir, "node_modules/lumiose"), "junction");
  for (const name of ["vite", "cli", "compiler"]) {
    symlinkSync(
      realpathSync(join(packages, name)),
      join(dir, `node_modules/@lumiose/${name}`),
      "junction",
    );
  }
}
