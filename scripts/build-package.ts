// `pnpm build` (and `prepack`) of a publishable package: compiles src/ to dist/ with the package's
// tsconfig.build.json (JavaScript plus declarations), then copies the files TypeScript does not emit
// (hand-written `.d.ts`, licenses, other assets) next to them. Tests, fixtures and test helpers are
// left out, as in tsconfig.build.json. Run from the package directory.
//
//   node ../../scripts/build-package.ts

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";

const SKIP_DIR = /^(?:__fixtures__|__tests__|\.fixtures|node_modules)$/;
const SKIP_FILE = /\.test\.ts$|^test-(?:links|client)\.ts$/;

/** Files under `dir` that TypeScript leaves out of dist: anything but `.ts` sources, and `.d.ts`. */
export function assetsOf(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR.test(entry.name)) assetsOf(path, out);
    } else if (
      !SKIP_FILE.test(entry.name) &&
      (!entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts"))
    ) {
      out.push(path);
    }
  }
  return out;
}

if (import.meta.main) {
  const cwd = process.cwd();
  const src = join(cwd, "src");
  const dist = join(cwd, "dist");
  rmSync(dist, { recursive: true, force: true });
  const manifest = createRequire(join(cwd, "package.json")).resolve("typescript/package.json");
  const tsc = join(dirname(manifest), "bin/tsc");
  execFileSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], { cwd, stdio: "inherit" });
  for (const file of assetsOf(src)) {
    const target = join(dist, relative(src, file));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(file, target);
  }
}
