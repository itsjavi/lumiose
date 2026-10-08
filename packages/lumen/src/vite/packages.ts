// Packages outside the Vite root (TASK-74). Island refs end up in server-rendered HTML and scope
// tokens hash a module's path, so neither may depend on where a module sits on the build
// machine. Inside the root both use root-relative paths; outside it, the compiler names modules
// package-relatively (`@acme/ui/src/Nav.stsx`) within the packages listed here:
//
// - the nearest named package of each compiled file outside the root;
// - the linked dependencies that use Lumen (they list `lumen` as a dependency), transitively
//   from the root's package: workspace packages (`workspace:*`, `link:`) whose real path is not
//   excluded. The one-time project scan (./scan.ts) also covers their directories, so a client
//   build knows their island call sites and stylesheets before the server graph exists.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PackageRoot } from "@lumen/compiler";
import { normalizePath } from "vite";

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export class Packages {
  readonly #root: string;
  readonly #exclude: RegExp;
  /** Directory → the nearest named package at or above it. */
  readonly #nearest = new Map<string, PackageRoot | null>();
  #linked: PackageRoot[] | undefined;

  constructor(root: string, exclude: RegExp) {
    this.#root = normalizePath(root).replace(/\/$/, "");
    this.#exclude = exclude;
  }

  /** The packages a compile of `file` names modules in (none for files inside the root). */
  for(file: string): PackageRoot[] {
    const linked = this.linked();
    if (isInside(file, this.#root)) return linked;
    const own = this.#nearestOf(dirname(file));
    return own === null || linked.some((p) => p.dir === own.dir) ? linked : [...linked, own];
  }

  /** The linked Lumen dependencies of the root's package, transitively, by name. */
  linked(): PackageRoot[] {
    if (this.#linked !== undefined) return this.#linked;
    const found = new Map<string, PackageRoot>();
    const visit = (dir: string, manifest: PackageJson): void => {
      for (const name of dependencyNames(manifest)) {
        if (name === "lumen" || found.has(name)) continue;
        const real = resolvePackage(dir, name);
        if (real === null || this.#exclude.test(`${real}/`) || isInside(real, this.#root)) continue;
        const dependency = readManifest(real);
        if (dependency === null || !dependencyNames(dependency).includes("lumen")) continue;
        found.set(name, { name, dir: real });
        visit(real, dependency);
      }
    };
    const own = nearestManifest(this.#root, false);
    if (own !== null) visit(own.dir, own.manifest);
    this.#linked = [...found.values()].toSorted((a, b) => (a.name < b.name ? -1 : 1));
    return this.#linked;
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
