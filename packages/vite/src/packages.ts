// The Lumiose packages a project uses (TASK-74, TASK-390): the dependencies, transitively from the
// root's package, that list `lumiose` as a dependency (any field), except Lumiose's own tooling.
// They hold components the app's compiler compiles, so @lumiose/vite treats them like the app's
// own modules:
//
// - linked workspace packages (`workspace:*`, `link:`) and packages installed in `node_modules`
//   (from npm or a tarball) alike, so a link and an install behave the same; the plugin's default
//   `exclude` (node_modules) leaves out every other installed package;
// - the one-time project scan (./scan.ts) covers their directories, so a client build knows their
//   island call sites, stylesheets and client scripts before the server graph exists;
// - they are bundled with the app's server code (`resolve.noExternal`) and kept out of Vite's
//   dependency optimizer, which would compile their `.tsx` as React JSX: one `lumiose` instance.
//
// Island refs end up in server-rendered HTML and scope tokens hash a module's path, so neither may
// depend on where a module sits on the build machine, or on the package manager's layout. Inside
// the root both use root-relative paths; inside a package listed here (and the nearest named
// package of a compiled file outside the root), the compiler names modules package-relatively
// (`@acme/ui/src/Nav.stsx`), the innermost directory winning: a package installed under the root's
// `node_modules` is named by its package.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PackageRoot } from "@lumiose/compiler";
import { normalizePath } from "vite";

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/**
 * Lumiose itself and its tooling: they list `lumiose` as a dependency but hold none of the app's
 * components (the CLI's test fixtures would otherwise join the scan, and the adapters would be
 * bundled with the server code).
 */
export const LUMIOSE_OWN_PACKAGES: ReadonlySet<string> = new Set([
  "lumiose",
  "@lumiose/vite",
  "@lumiose/cli",
  "@lumiose/compiler",
  "@lumiose/adapter-cloudflare",
  "@lumiose/adapter-netlify",
  "@lumiose/adapter-node",
  "@lumiose/adapter-vercel",
  "@lumiose/eslint-plugin",
  "@lumiose/language-server",
  "@lumiose/prettier-plugin",
  "create-lumiose",
]);

const NODE_MODULES = /[\\/]node_modules[\\/]/;

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export class Packages {
  readonly #root: string;
  /** The plugin's `exclude` option, when given: packages whose directory it matches are left out. */
  readonly #exclude: RegExp | undefined;
  /** Directory → the nearest named package at or above it. */
  readonly #nearest = new Map<string, PackageRoot | null>();
  #lumiose: PackageRoot[] | undefined;
  #installed: PackageRoot[] | undefined;

  constructor(root: string, exclude?: RegExp) {
    this.#root = normalizePath(root).replace(/\/$/, "");
    this.#exclude = exclude;
  }

  /** The packages a compile of `file` names modules in. */
  for(file: string): PackageRoot[] {
    const lumiose = this.lumiose();
    if (isInside(file, this.#root)) return lumiose;
    const own = this.#nearestOf(dirname(file));
    return own === null || lumiose.some((p) => p.dir === own.dir) ? lumiose : [...lumiose, own];
  }

  /**
   * The Lumiose packages of the root's package, transitively, by name: linked ones outside the
   * root (those inside it are the root's own sources) and installed ones.
   */
  lumiose(): PackageRoot[] {
    if (this.#lumiose !== undefined) return this.#lumiose;
    const found = new Map<string, PackageRoot>();
    const visit = (dir: string, manifest: PackageJson): void => {
      for (const name of dependencyNames(manifest)) {
        if (LUMIOSE_OWN_PACKAGES.has(name) || found.has(name)) continue;
        const real = resolvePackage(dir, name);
        if (real === null || this.#exclude?.test(`${real}/`)) continue;
        if (isInside(real, this.#root) && !isInstalled(real)) continue;
        const dependency = readManifest(real);
        if (dependency === null || !dependencyNames(dependency).includes("lumiose")) continue;
        found.set(name, { name, dir: real });
        visit(real, dependency);
      }
    };
    const own = nearestManifest(this.#root, false);
    if (own !== null) visit(own.dir, own.manifest);
    this.#lumiose = [...found.values()].toSorted((a, b) => (a.name < b.name ? -1 : 1));
    return this.#lumiose;
  }

  /** The Lumiose packages installed in `node_modules`. */
  installed(): PackageRoot[] {
    return (this.#installed ??= this.lumiose().filter((p) => isInstalled(p.dir)));
  }

  /** Whether `file` is a module of an installed Lumiose package (not of a package nested in it). */
  installs(file: string): boolean {
    return this.installedOf(file) !== undefined;
  }

  /** The installed Lumiose package `file` is a module of (not of a package nested in it). */
  installedOf(file: string): PackageRoot | undefined {
    return this.installed().find(
      (p) => isInside(file, p.dir) && !NODE_MODULES.test(file.slice(p.dir.length)),
    );
  }

  #nearestOf(dir: string): PackageRoot | null {
    let cached = this.#nearest.get(dir);
    if (cached === undefined) {
      const found = nearestManifest(dir, true);
      cached = found === null ? null : { name: found.manifest.name!, dir: found.dir };
      this.#nearest.set(dir, cached);
    }
    return cached;
  }
}

/** The nearest `package.json` at or above `start` (with a `name` when `named`). */
function nearestManifest(
  start: string,
  named: boolean,
): { dir: string; manifest: PackageJson } | null {
  for (let dir = normalizePath(start); ; dir = dirname(dir)) {
    const manifest = readManifest(dir);
    if (manifest !== null && (!named || typeof manifest.name === "string")) {
      return { dir, manifest };
    }
    if (dirname(dir) === dir) return null;
  }
}

function isInside(file: string, dir: string): boolean {
  return file.startsWith(`${dir}/`);
}

/** A package directory under `node_modules` (installed, not linked). */
function isInstalled(dir: string): boolean {
  return NODE_MODULES.test(`${dir}/`);
}

function dependencyNames(manifest: PackageJson): string[] {
  return DEPENDENCY_FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {}));
}

function readManifest(dir: string): PackageJson | null {
  const path = join(dir, "package.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
  } catch {
    return null;
  }
}

/** The real directory of dependency `name` as Node resolves it from `dir`, or `null`. */
function resolvePackage(dir: string, name: string): string | null {
  for (let current = dir; ; current = dirname(current)) {
    const candidate = join(current, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) {
      try {
        return normalizePath(realpathSync(candidate));
      } catch {
        return null;
      }
    }
    if (dirname(current) === current) return null;
  }
}
