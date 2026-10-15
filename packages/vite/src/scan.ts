// A one-time scan of the project's source modules (under the root and in the Lumiose packages of
// ./packages.ts, linked or installed), for what the client build must know before the server
// graph exists (the server environment is built after the client):
//
// - island call sites (`meta.islands`), mostly in route modules (./islands.ts);
// - stylesheets the server graph may import (./css-manifest.ts): every Lumiose module with style
//   blocks, and the CSS files imported by any source module (`import "./app.css"` in a layout);
// - client scripts of server-rendered components (./client-scripts.ts): imports with the
//   `?client` query, which the client build builds as entries.
//
// Lumiose modules are compiled once without CSS; other JS/TS modules are only searched for import
// specifiers. A specifier found in a comment only builds an unused stylesheet.

import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { compile, type IslandMeta } from "@lumiose/compiler";
import { isCSSRequest, normalizePath } from "vite";
import type { Content } from "./content.ts";
import type { Packages } from "./packages.ts";

/** Files that make a directory a project of its own. */
const PROJECT_FILE = /^(?:package\.json|tsconfig\.json|vite\.config\.[cm]?[jt]s)$/;
/** Directories never scanned. */
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "build", "coverage"]);
/** Directories of an installed package never scanned: its own dependencies are packages of theirs. */
const INSTALLED_SKIPPED_DIRECTORIES = new Set(["node_modules"]);
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
  /** Island call sites (Lumiose modules). */
  islands: readonly IslandMeta[];
  /** The module has style blocks (served as `<file>?lumiose&type=style&lang.css`). */
  hasStyles: boolean;
  /** Specifiers of the stylesheets it imports (`./app.css`, `pkg/theme.css`). */
  stylesheets: string[];
  /** Specifiers of the client scripts it imports (`./menu.element.ts?client`). */
  clientScripts?: string[];
}

/** Scans every source module under `root` and in the Lumiose packages. */
export function scanProject(
  root: string,
  include: RegExp,
  exclude: (file: string) => boolean,
  packages: Packages,
  content: Content | null = null,
): ScannedModule[] {
  const modules: ScannedModule[] = [];
  const installed = new Set(packages.installed());
  const files = [
    ...sourceFiles(root, "project"),
    // A linked package's nested projects (a showcase app, examples) and build output are not part
    // of its sources; an installed package is all published files, `dist/` included.
    ...packages
      .lumiose()
      .flatMap((p) => sourceFiles(p.dir, installed.has(p) ? "installed" : "linked")),
  ];
  for (const file of files) {
    // `.md`/`.html` files are compiled as their Lumiose module (`<file>.md.stsx`, ./content.ts).
    const contentModule = content?.scans(file) ? content.moduleId(file) : null;
    const lumiose = contentModule !== null || (include.test(file) && !exclude(file));
    if (!lumiose && (!SCRIPT_MODULE.test(file) || DECLARATION.test(file) || exclude(file))) {
      continue;
    }
    let source: string;
    try {
      source = contentModule ? content!.source(contentModule) : readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!lumiose) {
      const stylesheets = stylesheetImports(source);
      const clientScripts = clientScriptImports(source);
      if (stylesheets.length > 0 || clientScripts.length > 0) {
        modules.push({
          file,
          islands: [],
          hasStyles: false,
          stylesheets,
          ...(clientScripts.length > 0 ? { clientScripts } : {}),
        });
      }
      continue;
    }
    const result = compile(source, contentModule ?? file, {
      root,
      packages: packages.for(file),
      sourceMap: false,
      emitCss: false,
    });
    const clientScripts = clientScriptImports(result.code);
    modules.push({
      file: contentModule ?? file,
      islands: result.meta.islands,
      hasStyles: result.meta.hasStyles,
      // The compiled code: style blocks are gone, imports are printed verbatim, and the module's
      // own CSS module is imported when it has styles.
      stylesheets: stylesheetImports(result.code),
      ...(clientScripts.length > 0 ? { clientScripts } : {}),
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

/** The import query of client scripts (./client-scripts.ts, decision-63). */
const CLIENT_SCRIPT = /\?client$/;

export function clientScriptImports(code: string): string[] {
  const found = new Set<string>();
  for (const match of code.matchAll(IMPORT_SPECIFIER)) {
    if (CLIENT_SCRIPT.test(match[2]!)) found.add(match[2]!);
  }
  return [...found];
}

/**
 * Files under `root`: the project's (`project`), a linked package's, not in subdirectories that
 * are projects themselves (`linked`), or an installed package's, build output included
 * (`installed`).
 */
function sourceFiles(root: string, kind: "project" | "linked" | "installed"): string[] {
  const skipped = kind === "installed" ? INSTALLED_SKIPPED_DIRECTORIES : SKIPPED_DIRECTORIES;
  const files: string[] = [];
  const visit = (directory: string): void => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    if (kind === "linked" && directory !== root && entries.some(isProjectFile)) return;
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && !skipped.has(entry.name)) visit(path);
      } else if (entry.isFile()) {
        files.push(normalizePath(path));
      }
    }
  };
  visit(root);
  return files;
}

/** A file that makes its directory a project of its own (as for `lumiose check`). */
function isProjectFile(entry: Dirent): boolean {
  return entry.isFile() && PROJECT_FILE.test(entry.name);
}
