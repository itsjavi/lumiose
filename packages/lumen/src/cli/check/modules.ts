// Imported `$name` constants in tooling (spec §5.1). `compile()` cannot read files: it returns
// `moduleRequests`, and the host resolves and reads them and compiles again with `modules`.
// lumen/vite answers with Vite's resolver; `lumen check` and the language server answer with a
// {@link ModuleHost}: TypeScript-compatible resolution (`moduleResolution: "bundler"`) of
// relative paths, tsconfig `paths` and package `exports`/`imports`, with cached resolutions and
// sources, and the modules each compiled file read, so an edit to a constants module re-checks
// the files that depend on it.

import { readFileSync, realpathSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";

/** Extensions tried for an extensionless path, in TypeScript's order (plus `.stsx`). */
const EXTENSIONS = [".ts", ".tsx", ".stsx", ".js", ".jsx"];

/** Sources TypeScript looks for first when a specifier names an output extension. */
const SOURCES_OF: Readonly<Record<string, readonly string[]>> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".tsx"],
  ".mjs": [".mts"],
  ".cjs": [".cts"],
};

/**
 * Package `exports` conditions, as a client build matches them. Not `types`: declarations have
 * no values to fold.
 */
const CONDITIONS: ReadonlySet<string> = new Set(["import", "module", "browser", "default"]);

/** How a file changed (LSP `FileChangeType` order). */
export type ModuleChange = "created" | "changed" | "deleted";

export interface ModuleHostOptions {
  /** The project root. */
  root: string;
  /** The tsconfig whose `paths` apply, absolute or relative to `root`. Default `tsconfig.json`. */
  project?: string;
  /**
   * A file's text when it differs from the disk (an editor's unsaved buffer); `undefined` reads
   * the disk. Not cached: called on every read.
   */
  read?: (path: string) => string | undefined;
}

interface PathMapping {
  /** The directory `paths` targets are relative to (the tsconfig that declares them). */
  base: string;
  paths: Record<string, unknown>;
}

interface Manifest {
  exports?: unknown;
  imports?: unknown;
  main?: unknown;
  module?: unknown;
}

/**
 * Answers the compiler's module requests for one project: resolves specifiers, reads (and caches)
 * module sources, and remembers which modules each compiled file read.
 */
export class ModuleHost {
  readonly root: string;
  readonly #project: string;
  readonly #read: ((path: string) => string | undefined) | undefined;
  /** `<importer dir>\0<specifier>` → resolved file (`null`: unresolvable). */
  readonly #resolutions = new Map<string, string | null>();
  readonly #sources = new Map<string, Promise<string | undefined>>();
  /** Package directory → its `package.json` (`null`: none or invalid). */
  readonly #manifests = new Map<string, Manifest | null>();
  /** The tsconfig `paths` (`null`: none), loaded on first use. */
  #paths: PathMapping | null | undefined;
  /** The tsconfig files `paths` were read from (the `extends` chain). */
  #configs = new Set<string>();
  /** Compiled file → the module files its last compile read. */
  readonly #deps = new Map<string, readonly string[]>();

  constructor(options: ModuleHostOptions) {
    this.root = resolve(options.root);
    this.#project = resolve(this.root, options.project ?? "tsconfig.json");
    this.#read = options.read;
  }

  /** The file `specifier` imported from `importer` resolves to; `null` when there is none. */
  resolve(specifier: string, importer: string): string | null {
    const dir = dirname(importer);
    const key = `${dir}\0${specifier}`;
    let resolved = this.#resolutions.get(key);
    if (resolved === undefined) {
      resolved = this.#resolveUncached(specifier, dir) ?? null;
      this.#resolutions.set(key, resolved);
    }
    return resolved;
  }

  /** A module's source: the `read` overlay, else the file on disk (cached); `undefined` when unreadable. */
  load(path: string): Promise<string | undefined> {
    const live = this.#read?.(path);
    if (live !== undefined) return Promise.resolve(live);
    let source = this.#sources.get(path);
    if (source === undefined) {
      source = readFile(path, "utf8").catch(() => undefined);
      this.#sources.set(path, source);
    }
    return source;
  }

  /** Records the module files (`cssDeps`) the last compile of `file` read. */
  record(file: string, deps: readonly string[]): void {
    if (deps.length === 0) this.#deps.delete(file);
    else this.#deps.set(file, deps);
  }

  /** Compiled files whose last compile read `path`. */
  dependents(path: string): string[] {
    return [...this.#deps].filter(([, deps]) => deps.includes(path)).map(([file]) => file);
  }

  /**
   * Forgets what is known about `path` after it changed on disk or in an editor. Returns the
   * compiled files whose diagnostics may be stale: those that read it, or every recorded file
   * when files appeared or vanished or a tsconfig/package.json changed (resolutions may differ).
   */
  invalidate(path: string, change: ModuleChange = "changed"): string[] {
    this.#sources.delete(path);
    const name = basename(path);
    const config = this.#configs.has(path) || name === "package.json" || path === this.#project;
    if (change === "changed" && !config) return this.dependents(path);
    this.#resolutions.clear();
    if (config) {
      this.#manifests.clear();
      this.#paths = undefined;
    }
    return [...this.#deps.keys()];
  }

  #resolveUncached(specifier: string, dir: string): string | undefined {
    if (isPathSpecifier(specifier)) return resolvePath(resolve(dir, specifier));
    return (
      this.#resolveMapped(specifier) ??
      (specifier.startsWith("#")
        ? this.#resolveImports(specifier, dir)
        : this.#resolvePackage(specifier, dir))
    );
  }

  /** tsconfig `paths`: an exact key, else the pattern with the longest prefix; then its targets. */
  #resolveMapped(specifier: string): string | undefined {
    const mapping = this.#pathMapping();
    if (mapping === null) return undefined;
    const match = matchKey(Object.keys(mapping.paths), specifier);
    if (match === undefined) return undefined;
    const targets = mapping.paths[match.key];
    for (const target of Array.isArray(targets) ? targets : []) {
      if (typeof target !== "string") continue;
      const path = resolvePath(resolve(mapping.base, target.replace("*", match.star)));
      if (path !== undefined) return path;
    }
    // TypeScript falls back to node_modules when no target exists.
    return undefined;
  }

  #pathMapping(): PathMapping | null {
    if (this.#paths === undefined) {
      this.#configs = new Set();
      this.#paths = readPaths(this.#project, this.#configs) ?? null;
    }
    return this.#paths;
  }

  #resolvePackage(specifier: string, dir: string): string | undefined {
    const parsed = parsePackageSpecifier(specifier);
    if (parsed === undefined) return undefined;
    for (let current = dir; ; current = dirname(current)) {
      const candidate = join(current, "node_modules", parsed.name);
      if (isDirectory(candidate))
        return this.#resolveInPackage(realpath(candidate), parsed.subpath);
      if (dirname(current) === current) return undefined;
    }
  }

  #resolveInPackage(dir: string, subpath: string): string | undefined {
    const manifest = this.#manifest(dir);
    if (manifest?.exports !== undefined && manifest.exports !== null) {
      const target = exportTarget(manifest.exports, subpath);
      return target === undefined ? undefined : resolvePath(resolve(dir, target));
    }
    if (subpath !== ".") return resolvePath(join(dir, subpath));
    for (const entry of [manifest?.module, manifest?.main]) {
      if (typeof entry !== "string") continue;
      const path = resolvePath(resolve(dir, entry));
      if (path !== undefined) return path;
    }
    return resolvePath(join(dir, "index"));
  }

  /** Package `imports` (`#name`) of the nearest package.json. */
  #resolveImports(specifier: string, dir: string): string | undefined {
    for (let current = dir; ; current = dirname(current)) {
      const manifest = this.#manifest(current);
      if (manifest !== null) {
        const imports = manifest.imports;
        if (!isObject(imports)) return undefined;
        const match = matchKey(Object.keys(imports), specifier);
        const target = match && conditionalTarget(imports[match.key], match.star);
        if (target === undefined) return undefined;
        return isPathSpecifier(target)
          ? resolvePath(resolve(current, target))
          : this.#resolvePackage(target, current);
      }
      if (dirname(current) === current) return undefined;
    }
  }

  #manifest(dir: string): Manifest | null {
    let manifest = this.#manifests.get(dir);
    if (manifest === undefined) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
        manifest = isObject(parsed) ? parsed : null;
      } catch {
        manifest = null;
      }
      this.#manifests.set(dir, manifest);
    }
    return manifest;
  }
}

/** A relative or absolute path specifier. */
function isPathSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    isAbsolute(specifier)
  );
}

/**
 * A file path as TypeScript resolves it: an output extension maps to its source first, then the
 * file itself, then the path with each of {@link EXTENSIONS}, then a directory's `index`.
 */
export function resolvePath(path: string): string | undefined {
  const written = extname(path);
  for (const source of SOURCES_OF[written] ?? []) {
    const candidate = path.slice(0, -written.length) + source;
    if (isFile(candidate)) return candidate;
  }
  if (isFile(path)) return path;
  for (const extension of EXTENSIONS) {
    if (isFile(path + extension)) return path + extension;
  }
  if (isDirectory(path)) {
    for (const extension of EXTENSIONS) {
      const index = join(path, `index${extension}`);
      if (isFile(index)) return index;
    }
  }
  return undefined;
}

function parsePackageSpecifier(specifier: string): { name: string; subpath: string } | undefined {
  const parts = specifier.split("/");
  const length = specifier.startsWith("@") ? 2 : 1;
  if (parts.length < length || parts.slice(0, length).some((part) => part === "")) return undefined;
  const rest = parts.slice(length);
  return {
    name: parts.slice(0, length).join("/"),
    subpath: rest.length === 0 ? "." : `./${rest.join("/")}`,
  };
}

/**
 * The key of a `paths`/`exports`/`imports` map that matches `request`: the exact key, else the
 * `*` pattern with the longest prefix (then the longest key), with what `*` matched.
 */
function matchKey(
  keys: readonly string[],
  request: string,
): { key: string; star: string } | undefined {
  if (keys.includes(request) && !request.includes("*")) return { key: request, star: "" };
  let best: { key: string; star: string; prefix: number } | undefined;
  for (const key of keys) {
    const star = key.indexOf("*");
    if (star === -1 || key.indexOf("*", star + 1) !== -1) continue;
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    if (
      request.length < key.length - 1 ||
      !request.startsWith(prefix) ||
      !request.endsWith(suffix) ||
      (best !== undefined &&
        (star < best.prefix || (star === best.prefix && key.length <= best.key.length)))
    ) {
      continue;
    }
    best = { key, star: request.slice(star, request.length - suffix.length), prefix: star };
  }
  return best && { key: best.key, star: best.star };
}

/** The target of `subpath` in a package's `exports`. */
function exportTarget(exports: unknown, subpath: string): string | undefined {
  const subpaths =
    isObject(exports) && Object.keys(exports).some((key) => key.startsWith("."))
      ? exports
      : { ".": exports };
  const match = matchKey(Object.keys(subpaths), subpath);
  return match && conditionalTarget(subpaths[match.key], match.star);
}

/** Picks the first matching condition (or array fallback) of an export target. */
function conditionalTarget(value: unknown, star: string): string | undefined {
  if (typeof value === "string") return value.replaceAll("*", star);
  if (Array.isArray(value)) {
    for (const item of value) {
      const target = conditionalTarget(item, star);
      if (target !== undefined) return target;
    }
    return undefined;
  }
  if (isObject(value)) {
    for (const [condition, nested] of Object.entries(value)) {
      if (!CONDITIONS.has(condition)) continue;
      const target = conditionalTarget(nested, star);
      if (target !== undefined) return target;
    }
  }
  return undefined;
}

/**
 * `compilerOptions.paths` of a tsconfig, following `extends` (the nearest declaration wins and
 * its targets are relative to the declaring file; Lumen targets TypeScript 7, without `baseUrl`).
 * `files` collects the configs read.
 */
function readPaths(file: string, files: Set<string>): PathMapping | undefined {
  if (files.has(file)) return undefined;
  files.add(file);
  let config: unknown;
  try {
    config = parseJsonc(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
  if (!isObject(config)) return undefined;
  const options = config["compilerOptions"];
  if (isObject(options) && isObject(options["paths"])) {
    return { base: dirname(file), paths: options["paths"] };
  }
  const parents = config["extends"];
  let inherited: PathMapping | undefined;
  for (const parent of typeof parents === "string"
    ? [parents]
    : Array.isArray(parents)
      ? parents
      : []) {
    if (typeof parent !== "string") continue;
    const path = resolveExtends(parent, dirname(file));
    // Later entries of an `extends` array override earlier ones.
    inherited = (path === undefined ? undefined : readPaths(path, files)) ?? inherited;
  }
  return inherited;
}

function resolveExtends(specifier: string, dir: string): string | undefined {
  if (isPathSpecifier(specifier)) {
    const path = resolve(dir, specifier);
    return isFile(path) ? path : isFile(`${path}.json`) ? `${path}.json` : undefined;
  }
  const require = createRequire(join(dir, "tsconfig.json"));
  for (const candidate of [specifier, `${specifier}.json`, `${specifier}/tsconfig.json`]) {
    try {
      return require.resolve(candidate);
    } catch {
      // Next candidate.
    }
  }
  return undefined;
}

/** JSON with comments and trailing commas (tsconfig). */
export function parseJsonc(text: string): unknown {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '"') {
      const end = stringEnd(text, i);
      out += text.slice(i, end);
      i = end - 1;
    } else if (char === "/" && text[i + 1] === "/") {
      while (i + 1 < text.length && text[i + 1] !== "\n") i++;
    } else if (char === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
    } else if (char === "," && /^\s*[}\]]/.test(text.slice(i + 1).replace(COMMENTS, ""))) {
      // A trailing comma.
    } else {
      out += char;
    }
  }
  return JSON.parse(out);
}

/** Leading comments and whitespace (to look past them after a comma). */
const COMMENTS = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)+/;

/** The index after the closing quote of the string starting at `start`. */
function stringEnd(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === '"') return i + 1;
  }
  return text.length;
}

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

function isDirectory(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

function realpath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
