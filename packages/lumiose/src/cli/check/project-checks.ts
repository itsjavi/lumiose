// Project-wide diagnostics (TASK-137): checks that need every module of the project, not one file.
// - LUM4003: a server-only module in the client graph (./client-graph.ts).
// - LUM3012: a custom property set in a `style` prop that no stylesheet reads (the check
//   `lumiose build` runs, lumiose/vite's custom-properties.ts).
// `lumiose check` runs them over its compiled sources; the language server keeps a ProjectChecks per
// project root, which compiles only the files that changed since the last run.

import type { CompileResult, Diagnostic as CompilerDiagnostic } from "@lumiose/compiler";
import { join, resolve } from "node:path";
import { CustomPropertyCheck } from "../../vite/custom-properties.ts";
import { clientGraphDiagnostics } from "./client-graph.ts";
import type { FileDiagnostics } from "./index.ts";
import type { ModuleHost } from "./modules.ts";
import { listFiles, SOURCE_DIR } from "./shadow.ts";

/** Stylesheets whose `var()` reads count (plain CSS and preprocessors). */
const STYLESHEET = /\.(?:css|scss|sass|less|styl|stylus|pcss|postcss)$/i;
/** Lumiose modules whose style blocks count when another module imports them. */
const LUMIOSE_MODULE = /\.(?:stsx|md|html)$/i;

export interface CompiledSource {
  text: string;
  result: CompileResult;
}

/**
 * LUM4003 and LUM3012 for a project whose Lumiose modules are `compiled` (absolute file → text and
 * client compile result). Stylesheets read: every stylesheet under `src/`, and the stylesheets and
 * Lumiose modules the compiled modules import (also from packages).
 */
export async function projectDiagnostics(
  root: string,
  compiled: ReadonlyMap<string, CompiledSource>,
  host: ModuleHost,
): Promise<FileDiagnostics[]> {
  const results = new Map([...compiled].map(([file, { result }]) => [file, result]));
  const found = new Map<string, CompilerDiagnostic[]>();
  const add = (file: string, diagnostics: readonly CompilerDiagnostic[]) =>
    found.set(file, [...(found.get(file) ?? []), ...diagnostics]);

  for (const { file, diagnostics } of await clientGraphDiagnostics(root, results, host)) {
    add(file, diagnostics);
  }

  const properties = new CustomPropertyCheck();
  const sheets = new Set(await listFiles(join(root, SOURCE_DIR), (name) => STYLESHEET.test(name)));
  for (const [file, { text, result }] of compiled) {
    properties.module(file, text, result);
    for (const imported of result.meta.imports ?? []) {
      const target = host.resolve(imported.specifier, file);
      if (target === null || compiled.has(target)) continue;
      if (STYLESHEET.test(target) || LUMIOSE_MODULE.test(target)) sheets.add(target);
    }
  }
  for (const sheet of sheets) {
    const code = await host.load(sheet);
    if (code !== undefined) properties.stylesheet(sheet, code);
  }
  for (const unread of properties.unread()) add(unread.file, [unreadDiagnostic(unread)]);

  return [...found].map(([file, diagnostics]) => ({ file, diagnostics }));
}

function unreadDiagnostic(unread: { name: string; start: number; end: number }) {
  const { name } = unread;
  return {
    code: "LUM3012",
    severity: "warning",
    message: `\`${name}\` is set in a \`style\` prop, but no stylesheet of the project reads it`,
    span: { start: unread.start, end: unread.end },
    labels: [],
    help: `Read it with \`var(${name})\` in a \`<style>\` block or a stylesheet, or remove it.`,
    docs: "errors/LUM3012",
  } satisfies CompilerDiagnostic;
}

/** Compiles one Lumiose module for {@link ProjectChecks} (a client compile, as `lumiose check`'s). */
export type ProjectCompile = (text: string, file: string) => Promise<CompileResult>;

/**
 * Incremental {@link projectDiagnostics} for an editor: each run lists the project's `.stsx` and
 * `.tsx` files under `src/`, reads them through the module host (open documents win over the
 * disk) and compiles only those whose text changed since the last run.
 */
export class ProjectChecks {
  readonly root: string;
  readonly #host: ModuleHost;
  readonly #compile: ProjectCompile;
  readonly #compiled = new Map<string, CompiledSource>();

  constructor(root: string, host: ModuleHost, compile: ProjectCompile) {
    this.root = resolve(root);
    this.#host = host;
    this.#compile = compile;
  }

  /** The project's diagnostics by absolute file. */
  async run(): Promise<Map<string, readonly CompilerDiagnostic[]>> {
    const files = await listFiles(join(this.root, SOURCE_DIR), (name) =>
      /\.(?:stsx|tsx)$/.test(name),
    );
    const present = new Set(files);
    for (const file of this.#compiled.keys()) if (!present.has(file)) this.#compiled.delete(file);
    for (const file of files) {
      const text = await this.#host.load(file);
      if (text === undefined) continue;
      if (this.#compiled.get(file)?.text === text) continue;
      this.#compiled.set(file, { text, result: await this.#compile(text, file) });
    }
    const found = await projectDiagnostics(this.root, this.#compiled, this.#host);
    return new Map(found.map(({ file, diagnostics }) => [file, diagnostics]));
  }
}
