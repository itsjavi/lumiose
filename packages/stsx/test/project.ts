// Throwaway copies of the test fixtures, for the tests that edit files or write shadows (TASK-593).
//
// - **Inside this package** (`test/.tmp/`), so imports resolve through its node_modules as in a
//   real project. A copy in the OS temp directory needs a node_modules junction, and on GitHub's
//   Windows runners that junction crosses drives (the temp directory is on C:, the checkout on D:):
//   that was the one difference where `react` failed to resolve in dev on Windows CI.
// - **A Vite cache of its own** (`cacheDirOf`): a project without a package.json of its own uses
//   the nearest one's node_modules/.vite, so every project here would share this package's, and
//   concurrent test files would rewrite each other's optimized dependencies.

import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePath } from "vite";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const TMP = join(packageDir, "test/.tmp");

/** A new empty directory under `test/.tmp/`, as a normalized real path. */
export function tempDir(prefix: string): string {
  mkdirSync(TMP, { recursive: true });
  return normalizePath(realpathSync.native(mkdtempSync(join(TMP, `${prefix}-`))));
}

/** Copies `test/fixtures/<fixture>` (the files `filter` accepts) to `to`, a new directory by default. */
export function copyFixture(
  fixture: string,
  to: string = tempDir(fixture),
  filter?: (path: string) => boolean,
): string {
  cpSync(join(packageDir, "test/fixtures", fixture), to, {
    recursive: true,
    ...(filter === undefined ? {} : { filter }),
  });
  return to;
}

/** The Vite cache directory of a copied project (Vite's `cacheDir`). */
export function cacheDirOf(root: string): string {
  return `${root}/.vite`;
}

/** A Vite cache directory for the servers of one test file that use the fixtures in place. */
export function sharedCacheDir(testFile: string): string {
  return normalizePath(join(TMP, `cache-${testFile}`));
}

export function removeDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
