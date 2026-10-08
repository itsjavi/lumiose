// Style blocks in Vite (spec §4.6.6, decisions 12 and 14).
//
// - CSS modules. Compiled `.stsx` code imports `<file>?lumen&type=style&lang.css`. Its `load` hook
//   returns the stylesheet the compiler produced for the file, so Vite's CSS pipeline (PostCSS,
//   HMR, bundling, minification) takes it from there. The CSS of the last compile of each file is
//   cached; a load whose file changed on disk (or whose constants' modules changed) compiles again.
// - Imported `$name` constants. `compile()` cannot read files: it returns `moduleRequests`, which
//   are resolved with Vite's resolver, read from disk and passed back in `modules` (also for the
//   imports of those modules), until nothing is missing. The modules read are the file's
//   `cssDeps`: the CSS module adds them as watch files, so they join the module graph as its
//   imports, and an edit to `tokens.ts` hot-updates the CSS without touching the JS.
// - CSS-only HMR. When a Lumen file changes, the new source is compiled for the environment; if
//   its JS is unchanged (only style blocks were edited), the JS module is dropped from the update
//   and only its CSS module is hot-replaced: no re-run, no remount. The JS module's source map can
//   lag behind until its next real change (the code itself is identical).

import { readFile } from "node:fs/promises";
import { compile, type CompileOptions, type CompileResult, type HostModule } from "@lumen/compiler";

/**
 * Ids of style modules. Vite may add params around ours: `<link rel="stylesheet">` requests become
 * `?direct&lumen&type=style&lang.css` (plain CSS), and HMR adds `t=`.
 */
export const STYLE_QUERY = /[?&]lumen&type=style&lang\.css(?:&|$)/;

/** Resolves an import specifier to a module id; `null` when it cannot be resolved. */
export type Resolve = (specifier: string, importer: string) => Promise<string | null>;

export interface StyleEntry {
  /** The source text the entry was compiled from. */
  source: string;
  css: string | null;
  cssMap: string | null;
  /** Files of the modules imported constants were read from. */
  deps: string[];
  /** Diagnostics already reported (by the module's transform). */
  reported: boolean;
  result: CompileResult;
}

export type Target = "client" | "server";

/** The file of a module id (without query or hash). */
export function cleanId(id: string): string {
  return id.replace(/[?#].*$/, "");
}

/** Compiles `source`, answering module requests until nothing is missing. */
export async function compileWithModules(
  source: string,
  id: string,
  options: CompileOptions,
  resolve: Resolve,
): Promise<CompileResult> {
  const modules: HostModule[] = [];
  for (let round = 0; ; round++) {
    const result = compile(source, id, { ...options, modules });
    if (result.moduleRequests.length === 0 || round === 32) return result;
    for (const request of result.moduleRequests) {
      const resolvedId = await resolve(request.specifier, request.importer);
      let resolved: HostModule["resolved"];
      if (resolvedId !== null && !resolvedId.startsWith("\0")) {
        try {
          resolved = { id: resolvedId, source: await readFile(cleanId(resolvedId), "utf8") };
        } catch {
          // Unreadable: reported as LUM3008 by the compiler.
        }
      }
      modules.push({ importer: request.importer, specifier: request.specifier, resolved });
    }
  }
}

export class StyleCache {
  readonly #entries = new Map<string, StyleEntry>();
  /** Dependency file → Lumen files whose CSS reads it. */
  readonly #dependents = new Map<string, Set<string>>();
  /** The JS each environment target last ran per file (for CSS-only HMR). */
  readonly #code = new Map<string, Partial<Record<Target, string>>>();

  /** Records the result of compiling `file`; `reported` when its diagnostics were reported. */
  record(file: string, source: string, result: CompileResult, reported: boolean): StyleEntry {
    const previous = this.#entries.get(file);
    // A file that does not parse has no CSS: keep serving the last stylesheet meanwhile (the
    // module's transform reports the error).
    const kept = result.code === "" ? previous : undefined;
    const entry: StyleEntry = {
      source,
      css: kept?.css ?? result.css ?? null,
      cssMap: kept?.cssMap ?? result.cssMap ?? null,
      deps: kept?.deps ?? result.cssDeps.map(cleanId),
      reported,
      result,
    };
    for (const dep of previous?.deps ?? []) this.#dependents.get(dep)?.delete(file);
    for (const dep of entry.deps) {
      let files = this.#dependents.get(dep);
      if (files === undefined) this.#dependents.set(dep, (files = new Set()));
      files.add(file);
    }
    this.#entries.set(file, entry);
    return entry;
  }

  get(file: string): StyleEntry | undefined {
    return this.#entries.get(file);
  }

  /** The JS that `target` last compiled for `file`. */
  code(file: string, target: Target): string | undefined {
    return this.#code.get(file)?.[target];
  }

  setCode(file: string, target: Target, code: string): void {
    this.#code.set(file, { ...this.#code.get(file), [target]: code });
  }

  /** Lumen files whose CSS depends on `file`. */
  dependents(file: string): string[] {
    return [...(this.#dependents.get(file) ?? [])];
  }

  /** Forgets the CSS of files that depend on `file` (a constants module changed). */
  invalidateDependents(file: string): void {
    for (const dependent of this.dependents(file)) this.#entries.delete(dependent);
  }
}
