// Project-wide style symbols, indexed per file across the workspace (TASK-80):
// - global classes: the selectors of `<style global>` blocks and of imported global `.css` files
//   (both apply app-wide, spec §4.6.1), offered and defined in every file of the same project;
// - custom properties declared in any style of the project (`.stsx` blocks of every placement and
//   imported `.css` files): they are never scoped and inherit, so `var(--x)` can read any of them.
// `.css` files count when a module of the project imports them (`import "./app.css"`, not CSS
// modules or `?inline`/`?url` imports), directly or through `@import`.

import type { ScanResult } from "@lumen/compiler";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { selectorClasses } from "./classes.ts";
import { propertyDeclarations } from "./properties.ts";
import { virtualCss } from "./stsx.ts";
import { fileKey, pathToUri } from "./workspace.ts";

export interface StyleSymbol {
  /** A class without its dot, or a custom property with its dashes. */
  name: string;
  uri: string;
  /** Absolute path of the defining file. */
  path: string;
  /** The name's range. */
  range: Range;
}

export interface GlobalClass extends StyleSymbol {
  /** Set for classes of a `.css` file (else a `<style global>` block). */
  css?: boolean;
}

export interface CustomProperty extends StyleSymbol {
  /** The declared value, as written. */
  value: string;
  /** The enclosing rule (`:root`, `@media (…) .theme`). */
  selector: string;
  /** What declares it: a `.stsx` block by placement, or a `.css` file. */
  origin: "global" | "file" | "element" | "css";
}

/** Resolves an import like TypeScript does (paths, package exports); `null` when it cannot. */
export type ResolveImport = (specifier: string, importer: string) => string | null;

interface ModuleEntry {
  root: string;
  path: string;
  classes: GlobalClass[];
  properties: CustomProperty[];
  /** Specifiers of the global `.css` files the module imports. */
  cssImports: string[];
}

interface CssEntry {
  classes: GlobalClass[];
  properties: CustomProperty[];
  /** Resolved `@import`s. */
  imports: string[];
}

/** JS/TS modules whose CSS imports are indexed (`.d.ts` files import none). */
export const MODULE_EXTENSION = /(?<!\.d)\.(?:[cm]?[jt]s|[jt]sx)$/i;

export class ProjectStyles {
  readonly #modules = new Map<string, ModuleEntry>();
  /** `.css` files by key; `null` when unreadable. Loaded on demand, dropped when they change. */
  readonly #css = new Map<string, CssEntry | null>();
  readonly #resolve: ResolveImport;

  constructor(resolveImport: ResolveImport) {
    this.#resolve = resolveImport;
  }

  /** Indexes (or re-indexes) one `.stsx` file of the project at `root`. */
  updateStsx(path: string, root: string, text: string, scan: ScanResult, uri = pathToUri(path)) {
    const document = TextDocument.create(uri, "stsx", 0, text);
    const symbol = (name: string, start: number, end: number): StyleSymbol => ({
      name,
      uri,
      path,
      range: { start: document.positionAt(start), end: document.positionAt(end) },
    });
    const classes: GlobalClass[] = [];
    const properties: CustomProperty[] = [];
    for (const block of scan.blocks) {
      const css = virtualCss(text, block);
      const { start, end } = block.content;
      if (block.global) {
        for (const found of selectorClasses(css, start, end)) {
          classes.push(symbol(found.name, found.start, found.end));
        }
      }
      const origin = block.global ? "global" : block.placement === "jsx" ? "element" : "file";
      for (const found of propertyDeclarations(css, start, end)) {
        properties.push({
          ...symbol(found.name, found.start, found.end),
          // The source text: `$` references as written.
          value: text.slice(found.valueStart, found.valueEnd),
          selector: found.selector,
          origin,
        });
      }
    }
    this.#set(path, { root, path, classes, properties, cssImports: cssImports(scan.masked) });
  }

  /** Indexes the CSS imports of a JS or TS module. */
  updateModule(path: string, root: string, text: string): void {
    this.#set(path, { root, path, classes: [], properties: [], cssImports: cssImports(text) });
  }

  #set(path: string, entry: ModuleEntry): void {
    const empty =
      entry.classes.length === 0 && entry.properties.length === 0 && entry.cssImports.length === 0;
    if (empty) this.#modules.delete(fileKey(path));
    else this.#modules.set(fileKey(path), { ...entry, root: fileKey(entry.root) });
  }

  delete(path: string): void {
    this.#modules.delete(fileKey(path));
  }

  /** A `.css` file was created, changed or deleted: it is read again when next needed. */
  cssChanged(path: string): void {
    this.#css.delete(fileKey(path));
  }

  /** Global classes of the project at `root`, except those of the file `except` itself. */
  classes(root: string, except: string): GlobalClass[] {
    return [
      ...this.#others(root, except).flatMap((entry) => entry.classes),
      ...this.#reachableCss(root).flatMap((entry) => entry.classes),
    ];
  }

  /** Custom properties declared in the project at `root`, except in the file `except` itself. */
  customProperties(root: string, except: string): CustomProperty[] {
    return [
      ...this.#others(root, except).flatMap((entry) => entry.properties),
      ...this.#reachableCss(root).flatMap((entry) => entry.properties),
    ];
  }

  #others(root: string, except: string): ModuleEntry[] {
    const rootKey = fileKey(root);
    const exceptKey = fileKey(except);
    return [...this.#modules].flatMap(([key, entry]) =>
      entry.root === rootKey && key !== exceptKey ? [entry] : [],
    );
  }

  /** The `.css` files the project's modules import, with their `@import`s. */
  #reachableCss(root: string): CssEntry[] {
    const rootKey = fileKey(root);
    const seen = new Set<string>();
    const found: CssEntry[] = [];
    const visit = (path: string) => {
      const key = fileKey(path);
      if (seen.has(key)) return;
      seen.add(key);
      const entry = this.#cssEntry(path);
      if (!entry) return;
      found.push(entry);
      for (const imported of entry.imports) visit(imported);
    };
    for (const module of this.#modules.values()) {
      if (module.root !== rootKey) continue;
      for (const specifier of module.cssImports) {
        const path = this.#resolve(specifier, module.path);
        if (path !== null) visit(path);
      }
    }
    return found;
  }

  #cssEntry(path: string): CssEntry | null {
    const key = fileKey(path);
    let entry = this.#css.get(key);
    if (entry === undefined) {
      entry = readCss(path, this.#resolve);
      this.#css.set(key, entry);
    }
    return entry;
  }
}

/** The JS/TS modules under `<root>/src` (CSS imports come from the app's own modules). */
export async function projectModules(root: string): Promise<Array<{ path: string; text: string }>> {
  const src = join(root, "src");
  const entries = await readdir(src, { recursive: true, withFileTypes: true }).catch(() => []);
  const paths = entries
    .filter((entry) => entry.isFile() && MODULE_EXTENSION.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.includes(`${sep}node_modules${sep}`));
  const modules = await Promise.all(
    paths.map(async (path) => ({ path, text: await readFile(path, "utf8").catch(() => "") })),
  );
  return modules.filter((module) => module.text !== "");
}

/** Whether `path` is a JS/TS module of the project at `root` (under its `src`). */
export function isProjectModule(root: string, path: string): boolean {
  return MODULE_EXTENSION.test(path) && fileKey(path).startsWith(fileKey(join(root, "src")) + sep);
}

/**
 * Specifiers of global `.css` imports: `import "./app.css"` (or with bindings). CSS modules and
 * `?inline`/`?url`/`?raw` imports do not apply styles to the page.
 */
export function cssImports(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\bimport\s*(?:[^'";]*?\bfrom\s*)?(["'])([^"'\n]+?)\1/g)) {
    const specifier = match[2]!;
    if (/\.css$/i.test(specifier) && !/\.module\.css$/i.test(specifier)) found.push(specifier);
  }
  return found;
}

function readCss(path: string, resolveImport: ResolveImport): CssEntry | null {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const uri = pathToUri(path);
  const document = TextDocument.create(uri, "css", 0, text);
  const symbol = (name: string, start: number, end: number): StyleSymbol => ({
    name,
    uri,
    path,
    range: { start: document.positionAt(start), end: document.positionAt(end) },
  });
  const imports: string[] = [];
  for (const match of text.matchAll(/@import\s+(?:url\(\s*)?(["'])([^"']+)\1/g)) {
    const specifier = match[2]!;
    // CSS reads a bare `@import "a.css"` as relative; packages resolve like JS imports.
    const relative = resolve(dirname(path), specifier);
    const resolved = existsSync(relative) ? relative : resolveImport(specifier, path);
    if (resolved !== null && /\.css$/i.test(resolved)) imports.push(resolved);
  }
  return {
    classes: selectorClasses(text).map((found): GlobalClass => ({
      ...symbol(found.name, found.start, found.end),
      css: true,
    })),
    properties: propertyDeclarations(text).map((found) => ({
      ...symbol(found.name, found.start, found.end),
      value: text.slice(found.valueStart, found.valueEnd),
      selector: found.selector,
      origin: "css",
    })),
    imports,
  };
}
