// Shadow TSX for type checking (decision-86): every `.stsx` file of a project is mirrored as its
// masked TSX at `<shadow dir>/<same path>.stsx.tsx`. The masked text is offset-identical to the
// source, so stock `tsc` checks it through the tsconfig's `rootDirs` (`import "./X.stsx"` resolves
// to the shadow) and reports positions that are valid in the `.stsx` file.
//
// The shadow directory is the `rootDirs` entry named `stsx` (`[".", ".lumiose/stsx"]`), else
// `.lumiose/stsx`. `stsx typegen` writes every shadow and removes stale ones; the Vite plugin
// writes them when the dev server or a build starts, and again when a file changes.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { scan } from "@lumiose/compiler";

/** The default shadow directory, relative to the project root. */
export const DEFAULT_SHADOW_DIR = ".lumiose/stsx";

/** Directories never scanned for `.stsx` files. */
const SKIPPED = new Set(["node_modules", "dist", "build", "coverage"]);
const SHADOW_SUFFIX = ".tsx";

export interface ShadowLayout {
  /** The project root (absolute). */
  root: string;
  /** The shadow directory (absolute). */
  dir: string;
  /** Whether the tsconfig's `rootDirs` names the shadow directory. */
  configured: boolean;
}

/** The shadow layout of the project at `root`, from its `tsconfig.json`. */
export function shadowLayout(root: string): ShadowLayout {
  root = resolve(root);
  const rootDirs = readRootDirs(join(root, "tsconfig.json"));
  const named = rootDirs.find((dir) => /(?:^|[/\\])stsx[/\\]?$/.test(dir));
  return {
    root,
    dir: resolve(root, named ?? DEFAULT_SHADOW_DIR),
    configured: named !== undefined,
  };
}

/** The `rootDirs` line to add to tsconfig.json when it does not name the shadow directory. */
export function rootDirsHint(layout: ShadowLayout): string {
  const dir = relative(layout.root, layout.dir).replaceAll("\\", "/");
  return `"rootDirs": [".", "${dir}"]`;
}

/**
 * The shadow of `file` (absolute) in `layout`, or `undefined` for a file outside the root, such as
 * a linked package's (its own project checks it): its shadow would land outside `layout.dir`.
 */
export function shadowPathFor(layout: ShadowLayout, file: string): string | undefined {
  const path = relative(layout.root, file);
  if (path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) return undefined;
  return join(layout.dir, path + SHADOW_SUFFIX);
}

/** Writes the shadow of one `.stsx` file under the root (others have none). */
export function writeShadow(layout: ShadowLayout, file: string, source?: string): void {
  const shadow = shadowPathFor(layout, file);
  if (shadow === undefined) return;
  const text = source ?? readFileSync(file, "utf8");
  mkdirSync(dirname(shadow), { recursive: true });
  writeFileSync(shadow, scan(text, file).masked);
}

/** Writes the shadows of every `.stsx` file under the root and removes stale ones. */
export function syncShadows(layout: ShadowLayout): { written: number; removed: number } {
  const files = stsxFiles(layout.root, layout.dir);
  const expected = new Set(files.map((file) => shadowPathFor(layout, file)));
  for (const file of files) writeShadow(layout, file);
  let removed = 0;
  if (existsSync(layout.dir)) {
    for (const shadow of walk(layout.dir, () => true)) {
      if (shadow.endsWith(`.stsx${SHADOW_SUFFIX}`) && !expected.has(shadow)) {
        rmSync(shadow);
        removed++;
      }
    }
  }
  return { written: files.length, removed };
}

function stsxFiles(root: string, shadowDir: string): string[] {
  return walk(root, (dir, name) => {
    const path = join(dir, name);
    return !SKIPPED.has(name) && !name.startsWith(".") && path !== shadowDir;
  }).filter((file) => file.endsWith(".stsx"));
}

function walk(dir: string, enter: (dir: string, name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (enter(dir, entry.name)) out.push(...walk(join(dir, entry.name), enter));
    } else if (entry.isFile()) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/** `compilerOptions.rootDirs` of a tsconfig (JSON with comments and trailing commas). */
function readRootDirs(path: string): string[] {
  if (!existsSync(path)) return [];
  try {
    const text = readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\/|("(?:\\.|[^"\\])*")|\/\/[^\n]*/g, (match, string) => string ?? "")
      .replace(/,(\s*[}\]])/g, "$1");
    const rootDirs = (JSON.parse(text) as { compilerOptions?: { rootDirs?: unknown } })
      .compilerOptions?.rootDirs;
    return Array.isArray(rootDirs) ? rootDirs.filter((dir) => typeof dir === "string") : [];
  } catch {
    return [];
  }
}
