// A one-time scan of the project's source modules (under the root and in the linked Lumen
// packages of ./packages.ts), for what the client build must know before the server graph exists
// (the server environment is built after the client):
//
// - island call sites (`meta.islands`), mostly in route modules (./islands.ts);
// - stylesheets the server graph may import (./css-manifest.ts): every Lumen module with style
//   blocks, and the CSS files imported by any source module (`import "./app.css"` in a layout).
//
// Lumen modules are compiled once without CSS; other JS/TS modules are only searched for import
// specifiers. A specifier found in a comment only builds an unused stylesheet.

import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { compile, type IslandMeta } from "@lumen/compiler";
import { isCSSRequest, normalizePath } from "vite";
import type { Packages } from "./packages.ts";

/** Files that make a directory a project of its own. */
const PROJECT_FILE = /^(?:package\.json|tsconfig\.json|vite\.config\.[cm]?[jt]s)$/;
/** Directories never scanned. */
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "build", "coverage"]);
/** Other source modules searched for stylesheet imports. */
const SCRIPT_MODULE = /\.(?:[cm]?[jt]sx?)$/;
const DECLARATION = /\.d\.[cm]?ts$/;
/** Static import specifiers (`import "x"`, `import a, { b } from "x"`), not `@import` or `import()`. */
const IMPORT_SPECIFIER = /(?<![.@\w$])import\s*(?:[\w$*{}\s,]+?\s*from\s*)?(["'])([^"'\n]+)\1/g;
/** CSS imports that are not stylesheets of the page. */
const NOT_A_STYLESHEET = /[?&](?:inline|url|raw)\b/;

export interface ScannedModule {
  /** Absolute file path (POSIX separators). */
  file: string;
  /** Island call sites (Lumen modules). */
  islands: readonly IslandMeta[];
  /** The module has style blocks (served as `<file>?lumen&type=style&lang.css`). */
  hasStyles: boolean;
  /** Specifiers of the stylesheets it imports (`./app.css`, `pkg/theme.css`). */
  stylesheets: string[];
}

/** Scans every source module under `root` and in the linked Lumen packages. */
export function scanProject(
  root: string,
  include: RegExp,
  exclude: RegExp,
  packages: Packages,
): ScannedModule[] {
  const modules: ScannedModule[] = [];
  const files = [
    ...sourceFiles(root, false),
    // A linked package's nested projects (a showcase app, examples) are not part of it.
    ...packages.linked().flatMap((p) => sourceFiles(p.dir, true)),
  ];
  for (const file of files) {
    const lumen = include.test(file) && !exclude.test(file);
    if (!lumen && (!SCRIPT_MODULE.test(file) || DECLARATION.test(file) || exclude.test(file))) {
      continue;
    }
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!lumen) {
      const stylesheets = stylesheetImports(source);
      if (stylesheets.length > 0)
        modules.push({ file, islands: [], hasStyles: false, stylesheets });
      continue;
    }
    const result = compile(source, file, {
      root,
      packages: packages.for(file),
      sourceMap: false,
      emitCss: false,
    });
    modules.push({
      file,
      islands: result.meta.islands,
      hasStyles: result.meta.hasStyles,
      // The compiled code: style blocks are gone, imports are printed verbatim, and the module's
      // own CSS module is imported when it has styles.
      stylesheets: stylesheetImports(result.code),
    });
  }
  return modules;
}

export function stylesheetImports(code: string): string[] {
  const found = new Set<string>();
  for (const match of code.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[2]!;
    if (isCSSRequest(specifier) && !NOT_A_STYLESHEET.test(specifier)) found.add(specifier);
  }
  return [...found];
}

/** Files under `root`; with `skipProjects`, not in subdirectories that are projects themselves. */
function sourceFiles(root: string, skipProjects: boolean): string[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    if (skipProjects && directory !== root && entries.some(isProjectFile)) return;
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && !SKIPPED_DIRECTORIES.has(entry.name)) visit(path);
      } else if (entry.isFile()) {
        files.push(normalizePath(path));
      }
    }
  };
  visit(root);
  return files;
}

/** A file that makes its directory a project of its own (as for `lumen check`). */
function isProjectFile(entry: Dirent): boolean {
  return entry.isFile() && PROJECT_FILE.test(entry.name);
}
