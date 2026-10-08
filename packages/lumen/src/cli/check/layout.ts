// Where shadow TSX files live (TASK-73, spec §9.1). TypeScript joins `.stsx` sources to their
// shadows with tsconfig `rootDirs`: it merges `B/p` and `<root>/.lumen/shadow/p` into one virtual
// directory, so `import "./X.stsx"` in `B/p/a.ts` finds `<root>/.lumen/shadow/p/X.stsx.tsx`.
// Lumen reads that pair from the project's tsconfig and writes the shadow of a source `F` at
// `<root>/.lumen/shadow/<F relative to B>.tsx`. A shadow then sits as deep below the shadow
// directory as its source below `B`, so a relative specifier resolves to the same module from
// both, as long as it stays inside `B/p`.
//
// - The Lumen template pairs `src` with `.lumen/shadow/src` (B is the root): the project's own
//   `src/**/*.stsx` are shadowed, and `.stsx` files must not import across `src/`.
// - The generated `.lumen/tsconfig.generated.json`, for a tsconfig to extend, pairs the *mirror base* with
//   `.lumen/shadow`: the nearest common directory of the root and the Lumen packages it uses.
//   Imports may then leave `src/`, and the `.stsx` modules of linked workspace packages
//   (`@acme/ui` re-exporting `./Button.stsx`) are shadowed and type-check too.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { readTsconfigOption } from "./modules.ts";

export const SHADOW_DIR = ".lumen/shadow";
/** The project's own sources: `.stsx` files under it are always shadowed. */
export const SOURCE_DIR = "src";
/**
 * The generated tsconfig that a project's tsconfig may extend. Not named `tsconfig.json`: editors
 * would pick the nearest `tsconfig.json` as the project of the shadows below it.
 */
export const LUMEN_TSCONFIG = ".lumen/tsconfig.generated.json";

/** Linked packages under `node_modules` are not Lumen sources (lumen/vite's default exclude). */
const NODE_MODULES = /[\\/]node_modules[\\/]/;

export interface ShadowLayout {
  /** The project root. */
  root: string;
  /** The directory mirrored at `.lumen/shadow` (B). */
  base: string;
  /** The `rootDirs` entry paired with the shadows (`B/p`); sources outside it get no shadow. */
  mirrored: string;
  /** Directories of the Lumen packages the project uses whose `.stsx` files are shadowed. */
  packages: string[];
  /** Directories of Lumen packages the project uses that lie outside `mirrored`. */
  outside: string[];
}

/** The shadow layout of `root` from its tsconfig's `rootDirs` (default: `src` ↔ `.lumen/shadow/src`). */
export function shadowLayout(root: string, project = "tsconfig.json"): ShadowLayout {
  root = resolve(root);
  const found = readTsconfigOption(resolve(root, project), "rootDirs");
  const rootDirs = Array.isArray(found?.value)
    ? found.value.filter((dir) => typeof dir === "string").map((dir) => resolve(found.base, dir))
    : [];
  const pair = shadowPair(root, rootDirs) ?? { base: root, mirrored: join(root, SOURCE_DIR) };
  const used = lumenPackages(root);
  return {
    root,
    ...pair,
    packages: used.filter((dir) => isWithin(dir, pair.mirrored)),
    outside: used.filter((dir) => !isWithin(dir, pair.mirrored)),
  };
}

/**
 * The `rootDirs` pair that joins sources to shadows: an entry at or under `<root>/.lumen/shadow`
 * (`.lumen/shadow/p`) and another entry `B/p` that contains the root's `src`. `undefined` when
 * the absolute `rootDirs` have no such pair.
 */
export function shadowPair(
  root: string,
  rootDirs: readonly string[],
): { base: string; mirrored: string } | undefined {
  const shadowRoot = join(root, SHADOW_DIR);
  const sources = join(root, SOURCE_DIR);
  for (const dir of rootDirs) {
    if (!isWithin(dir, shadowRoot)) continue;
    const suffix = relative(shadowRoot, dir);
    for (const other of rootDirs) {
      if (isWithin(other, shadowRoot) || !isWithin(sources, other)) continue;
      const base = suffix === "" ? other : stripSuffix(other, suffix);
      if (base !== undefined) return { base, mirrored: other };
    }
  }
  return undefined;
}

/**
 * The Lumen packages a project uses, as directories: the linked dependencies that list `lumen` as
 * a dependency, transitively from the nearest `package.json` (the packages lumen/vite scans; see
 * vite/packages.ts) and, for a project without its own `package.json` (a showcase inside a
 * library), that enclosing package when it uses Lumen.
 */
export function lumenPackages(root: string): string[] {
  root = resolve(root);
  const dirs = new Set<string>();
  const visit = (dir: string, manifest: Manifest): void => {
    for (const name of dependencyNames(manifest)) {
      if (name === "lumen") continue;
      const real = resolvePackage(dir, name);
      if (real === undefined || dirs.has(real) || NODE_MODULES.test(real + sep)) continue;
      if (isWithin(real, root)) continue;
      const dependency = readManifest(real);
      if (dependency === undefined || !dependencyNames(dependency).includes("lumen")) continue;
      dirs.add(real);
      visit(real, dependency);
    }
  };
  for (let dir = root; ; dir = dirname(dir)) {
    const manifest = readManifest(dir);
    if (manifest !== undefined) {
      if (dir !== root && dependencyNames(manifest).includes("lumen")) dirs.add(dir);
      visit(dir, manifest);
      break;
    }
    if (dirname(dir) === dir) break;
  }
  return [...dirs].toSorted();
}

/** The compiler options of spec §4.7 besides `rootDirs`, which depends on the layout. */
export const LUMEN_COMPILER_OPTIONS = {
  jsx: "preserve",
  jsxImportSource: "lumen",
  module: "preserve",
  moduleResolution: "bundler",
  allowImportingTsExtensions: true,
  noEmit: true,
  strict: true,
  types: ["lumen/env"],
} as const;

/**
 * The content of {@link LUMEN_TSCONFIG}, which a project's tsconfig extends (decision-25): the
 * Lumen compiler options with a mirror-base `rootDirs` pair, and the includes.
 */
export function lumenTsconfig(root: string, packages = lumenPackages(root)): string {
  root = resolve(root);
  const base = packages.reduce(commonDir, root);
  const dir = dirname(join(root, LUMEN_TSCONFIG));
  const { types, ...options } = LUMEN_COMPILER_OPTIONS;
  const config = {
    compilerOptions: {
      ...options,
      // The mirror base and the shadow directory (see lumen check): `.stsx` imports may leave
      // `src/` and reach the `.stsx` modules of the Lumen packages this project uses.
      rootDirs: [posix(relative(dir, base)) || ".", "./shadow"],
      types,
    },
    include: ["../src", "./shadow", "./types"],
  };
  return (
    "// Generated by Lumen (lumen check, lumen typegen, lumen dev and the language server).\n" +
    `// Extend it from tsconfig.json: "extends": "./${LUMEN_TSCONFIG}". Do not edit.\n` +
    `${JSON.stringify(config, null, 2)}\n`
  );
}

/** Writes {@link LUMEN_TSCONFIG} when it changed; `true` when written. */
export async function writeLumenTsconfig(root: string, packages?: string[]): Promise<boolean> {
  const file = join(resolve(root), LUMEN_TSCONFIG);
  const content = lumenTsconfig(root, packages);
  if ((await readFile(file, "utf8").catch(() => undefined)) === content) return false;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
  return true;
}

/** Whether `path` is `dir` or inside it. */
export function isWithin(path: string, dir: string): boolean {
  const rel = relative(dir, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** `dir` without its trailing path `suffix` (`/w/src` minus `src` is `/w`), or `undefined`. */
function stripSuffix(dir: string, suffix: string): string | undefined {
  const ending = sep + suffix;
  return dir.endsWith(ending) ? dir.slice(0, -ending.length) || sep : undefined;
}

function commonDir(a: string, b: string): string {
  let dir = a;
  while (!isWithin(b, dir) && dirname(dir) !== dir) dir = dirname(dir);
  return dir;
}

type Manifest = Record<string, unknown>;

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

function dependencyNames(manifest: Manifest): string[] {
  return DEPENDENCY_FIELDS.flatMap((field) => {
    const dependencies = manifest[field];
    return typeof dependencies === "object" && dependencies !== null
      ? Object.keys(dependencies)
      : [];
  });
}

function readManifest(dir: string): Manifest | undefined {
  try {
    const json: unknown = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    return typeof json === "object" && json !== null ? (json as Manifest) : undefined;
  } catch {
    return undefined;
  }
}

/** The real directory of dependency `name` as Node resolves it from `dir`. */
function resolvePackage(dir: string, name: string): string | undefined {
  for (let current = dir; ; current = dirname(current)) {
    const candidate = join(current, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) {
      try {
        return realpathSync(candidate);
      } catch {
        return undefined;
      }
    }
    if (dirname(current) === current) return undefined;
  }
}

function posix(path: string): string {
  return path.split(sep).join("/");
}
