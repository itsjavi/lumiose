// Scope tokens hash a module's path relative to the project root, so builds do not depend on where
// the project sits on disk. A `.stsx` file outside the root (a linked workspace package) is named
// relative to its own package instead (`@acme/ui/src/Card.stsx`): the compiler gets that package's
// name and directory.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { normalizePath } from "vite";

export interface PackageRoot {
  name: string;
  dir: string;
}

const cache = new Map<string, PackageRoot | null>();

/** The package that contains `file` when it is outside `root`, for the compiler's `packages`. */
export function packagesFor(file: string, root: string): PackageRoot[] {
  if (file.startsWith(`${root}/`)) return [];
  const found = packageOf(dirname(file));
  return found === null ? [] : [found];
}

function packageOf(dir: string): PackageRoot | null {
  const cached = cache.get(dir);
  if (cached !== undefined) return cached;
  let found: PackageRoot | null = null;
  const manifest = join(dir, "package.json");
  if (existsSync(manifest)) {
    try {
      const { name } = JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown };
      if (typeof name === "string") found = { name, dir: normalizePath(dir) };
    } catch {
      // An unreadable manifest names no package.
    }
  }
  if (found === null && dirname(dir) !== dir) found = packageOf(dirname(dir));
  cache.set(dir, found);
  return found;
}
