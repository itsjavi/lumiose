// Shadow TSX (spec §9.1, decision-11). Every `src/**/*.stsx` is mirrored as its masked TSX at
// `.lumiose/shadow/<same path>.stsx.tsx`. The masked text is offset-identical to the source in
// UTF-16 code units, so stock TypeScript type-checks it (with `rootDirs`, `import "./X.stsx"`
// resolves to the shadow) and every position it reports is valid in the `.stsx` file. The
// tsconfig's `rootDirs` pair decides the paths, and whether the `.stsx` modules of the Lumiose
// packages the project uses are shadowed too (./layout.ts).
//
// Shared by `lumiose check`, `lumiose typegen`, `lumiose lint` and the language server.

import type { ScanResult } from "@lumiose/compiler";
import { mkdir, readdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { CheckFailure } from "./diagnostics.ts";
import {
  isWithin,
  SHADOW_DIR,
  shadowLayout,
  SOURCE_DIR,
  writeLumioseTsconfig,
  type ShadowLayout,
} from "@lumiose/vite/internal/layout.ts";

export {
  LUMIOSE_TSCONFIG,
  lumioseTsconfig,
  SHADOW_DIR,
  shadowLayout,
  SOURCE_DIR,
  writeLumioseTsconfig,
  type ShadowLayout,
} from "@lumiose/vite/internal/layout.ts";

const SHADOW_SUFFIX = ".tsx";

export interface ShadowFile {
  /** Absolute path of the `.stsx` source. */
  source: string;
  /** Absolute path of its shadow. */
  shadow: string;
  /** The source text. */
  text: string;
  /** The scanner result: masked TSX, style blocks and scanner diagnostics. */
  scan: ScanResult;
  /** Whether the source is the project's own (under `src/`), not a used package's. */
  own: boolean;
}

export interface SyncShadowsOptions {
  /**
   * Sync only these sources (absolute or root-relative paths); a listed source that no longer
   * exists has its shadow deleted. Default: every `.stsx` under `src/` and the shadowed packages,
   * deleting all orphans (a full sync also writes `.lumiose/tsconfig.generated.json`).
   */
  files?: readonly string[];
  /** The tsconfig whose `rootDirs` place the shadows, relative to the root. Default `tsconfig.json`. */
  project?: string;
  /** A layout already read (the language server caches them); default: read from the tsconfig. */
  layout?: ShadowLayout;
}

export interface SyncShadowsResult {
  /** The synced sources, sorted by path. */
  files: ShadowFile[];
  /** Absolute paths of shadows written because they were new or changed. */
  written: string[];
  /** Absolute paths of shadows deleted because their source is gone. */
  deleted: string[];
  /** Where the shadows are. */
  layout: ShadowLayout;
}

/**
 * `<root>/src/a/B.stsx` → `<root>/.lumiose/shadow/src/a/B.stsx.tsx`: the source's path relative to
 * the layout's mirror base (default: the root) below `.lumiose/shadow`.
 */
export function shadowPathFor(
  root: string,
  source: string,
  layout?: Pick<ShadowLayout, "base">,
): string {
  const base = layout?.base ?? root;
  return join(root, SHADOW_DIR, relative(base, resolve(root, source)) + SHADOW_SUFFIX);
}

/** The inverse of {@link shadowPathFor}; `undefined` for a path that is not a shadow. */
export function sourcePathForShadow(
  root: string,
  shadow: string,
  layout?: Pick<ShadowLayout, "base">,
): string | undefined {
  const rel = relative(join(root, SHADOW_DIR), resolve(root, shadow));
  if (rel.startsWith("..") || isAbsolute(rel) || !rel.endsWith(".stsx" + SHADOW_SUFFIX)) {
    return undefined;
  }
  return join(layout?.base ?? root, rel.slice(0, -SHADOW_SUFFIX.length));
}

/** Writes changed shadows and deletes those whose source is gone. */
export async function syncShadows(
  root: string,
  options: SyncShadowsOptions = {},
): Promise<SyncShadowsResult> {
  root = resolve(root);
  const { scan } = await loadCompiler();
  const sourceDir = join(root, SOURCE_DIR);
  const full = options.files === undefined;
  // The project's tsconfig may extend the generated one, so it is written before it is read.
  if (full) await writeLumioseTsconfig(root);
  const layout = options.layout ?? shadowLayout(root, options.project);
  const dirs = [sourceDir, ...layout.packages];
  const candidates = full
    ? (
        await Promise.all(
          dirs.map((dir) =>
            listFiles(dir, (name) => name.endsWith(".stsx"), dir === sourceDir ? undefined : dir),
          ),
        )
      ).flat()
    : options
        .files!.map((file) => resolve(root, file))
        .filter((file) => dirs.some((dir) => isStsxIn(dir, file)));

  const files: ShadowFile[] = [];
  const written: string[] = [];
  const deleted: string[] = [];
  await Promise.all(
    [...new Set(candidates)].map(async (source) => {
      const shadow = shadowPathFor(root, source, layout);
      const text = await readFile(source, "utf8").catch(ignoreMissing);
      if (text === undefined) {
        if (await removeFile(shadow)) deleted.push(shadow);
        return;
      }
      const result = scan(text, source);
      files.push({ source, shadow, text, scan: result, own: isWithin(source, sourceDir) });
      if (await writeIfChanged(shadow, result.masked)) written.push(shadow);
    }),
  );

  if (full) {
    const expected = new Set(files.map((file) => file.shadow));
    const shadows = await listFiles(join(root, SHADOW_DIR), (name) =>
      name.endsWith(".stsx" + SHADOW_SUFFIX),
    );
    for (const shadow of shadows) {
      if (!expected.has(shadow) && (await removeFile(shadow))) deleted.push(shadow);
    }
  }
  await removeEmptyDirs(
    deleted.map((shadow) => dirname(shadow)),
    join(root, SHADOW_DIR),
  );

  return {
    files: files.toSorted((a, b) => compare(a.source, b.source)),
    written: written.toSorted(compare),
    deleted: deleted.toSorted(compare),
    layout,
  };
}

type Compiler = typeof import("@lumiose/compiler");
let compiler: Promise<Compiler> | undefined;

/** Loads the native scanner once; a missing binding is a tool failure, not a code error. */
export function loadCompiler(): Promise<Compiler> {
  compiler ??= import("@lumiose/compiler").catch((cause: unknown) => {
    compiler = undefined;
    throw new CheckFailure(
      "The Lumiose compiler binding (@lumiose/compiler) could not be loaded.",
      {
        help: "Reinstall dependencies; in the Lumiose repo, run `pnpm --filter @lumiose/compiler build`.",
        cause,
      },
    );
  });
  return compiler;
}

function isStsxIn(dir: string, file: string): boolean {
  const rel = relative(dir, file);
  return file.endsWith(".stsx") && !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Absolute paths of matching files under `dir`, skipping dot-entries and `node_modules`. Below a
 * `packageDir`, directories of nested projects (with a `package.json` or `tsconfig.json`) are
 * skipped too: they are checked on their own.
 */
export async function listFiles(
  dir: string,
  match: (name: string) => boolean,
  packageDir?: string,
): Promise<string[]> {
  if (packageDir !== undefined && dir !== packageDir && isProjectDir(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(ignoreMissing);
  if (entries === undefined) return [];
  const nested = await Promise.all(
    entries.map(async (entry) => {
      if (entry.name.startsWith(".") || entry.name === "node_modules") return [];
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(path, match, packageDir);
      return entry.isFile() && match(entry.name) ? [path] : [];
    }),
  );
  return nested.flat();
}

function isProjectDir(dir: string): boolean {
  return existsSync(join(dir, "package.json")) || existsSync(join(dir, "tsconfig.json"));
}

async function writeIfChanged(file: string, content: string): Promise<boolean> {
  const current = await readFile(file, "utf8").catch(ignoreMissing);
  if (current === content) return false;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
  return true;
}

async function removeFile(file: string): Promise<boolean> {
  try {
    await rm(file);
    return true;
  } catch (error) {
    return ignoreMissing(error) ?? false;
  }
}

/** Removes now-empty directories from each of `dirs` up to (excluding) `stop`. */
async function removeEmptyDirs(dirs: string[], stop: string): Promise<void> {
  const deepestFirst = [...new Set(dirs)].toSorted(
    (a, b) => b.split(sep).length - a.split(sep).length,
  );
  for (let dir of deepestFirst) {
    while (dir !== stop && dir.startsWith(stop + sep)) {
      try {
        await rmdir(dir);
      } catch {
        break; // not empty (or already gone)
      }
      dir = dirname(dir);
    }
  }
}

function ignoreMissing(error: unknown): undefined {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
  throw error;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
