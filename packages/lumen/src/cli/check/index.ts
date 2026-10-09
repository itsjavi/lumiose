// `lumen check` (spec §9.1): typegen, shadow sync, then `tsc --noEmit` on the project, with
// TypeScript positions in shadow files mapped back to their `.stsx` sources (same line and
// column), merged with scanner, route and other Lumen diagnostics.

import type { Diagnostic as CompilerDiagnostic } from "@lumen/compiler";
import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { ROUTE_TYPES_FILE, typegen } from "../../app/typegen/index.ts";
import { EXIT_FAILURE, EXIT_OK, EXIT_PROBLEMS } from "../output.ts";
import { routeOptions } from "../project.ts";
import { compilerDiagnostics } from "./compile.ts";
import {
  CheckFailure,
  dropSuperseded,
  fromAppDiagnostic,
  fromCompilerDiagnostic,
  normalizeDiagnostics,
  summarize,
  type CheckDiagnostic,
  type CheckSummary,
} from "./diagnostics.ts";
import {
  islandPropMessage,
  islandPropProblem,
  islandPropRange,
  LUM_ISLAND_PROP,
  type IslandPropProblem,
} from "./island-props.ts";
import { formatHuman, formatJson, type CheckReport } from "./report.ts";
import { listFiles, sourcePathForShadow, syncShadows, type ShadowFile } from "./shadow.ts";
import { SourceText } from "./text.ts";
import {
  formatTsconfig,
  LUM_TSCONFIG,
  showConfig,
  tsconfigProblems,
  type TsconfigProblem,
} from "./tsconfig.ts";
import { parseTscOutput, resolveTypeScript, runTsc, type TscDiagnostic } from "./tsc.ts";

export type {
  CheckDiagnostic,
  CheckSummary,
  DiagnosticSeverity,
  DiagnosticSource,
} from "./diagnostics.ts";
export {
  compileDiagnostics,
  compilerDiagnostics,
  compileWithModules,
  type CompileDiagnosticsOptions,
} from "./compile.ts";
export { ModuleHost, type ModuleChange, type ModuleHostOptions } from "./modules.ts";
export { CheckFailure, SUPERSEDED_BY_TYPESCRIPT } from "./diagnostics.ts";
export {
  islandPropMessage,
  islandPropProblem,
  islandPropRange,
  LUM_ISLAND_PROP,
  type IslandPropProblem,
} from "./island-props.ts";
export { formatHuman, formatJson, type CheckReport } from "./report.ts";
export {
  LUMEN_TSCONFIG,
  lumenTsconfig,
  SHADOW_DIR,
  shadowLayout,
  shadowPathFor,
  sourcePathForShadow,
  syncShadows,
  writeLumenTsconfig,
  type ShadowFile,
  type ShadowLayout,
  type SyncShadowsOptions,
  type SyncShadowsResult,
} from "./shadow.ts";
export { formatTsconfig, LUM_TSCONFIG, standaloneTsconfig, tsconfigTemplate } from "./tsconfig.ts";
export { parseTscOutput } from "./tsc.ts";

/** Exit codes: no errors, errors found, the tool itself failed. */
export { EXIT_FAILURE, EXIT_OK, EXIT_PROBLEMS as EXIT_ERRORS };

/** Compiler-shaped diagnostics (UTF-16 spans) for one absolute file path. */
export interface FileDiagnostics {
  file: string;
  diagnostics: readonly CompilerDiagnostic[];
}

/**
 * Hook for more Lumen diagnostics (lint results, …). It runs after shadow sync; `files` holds the
 * project's own scanned `.stsx` files with their source text and scan result (used packages'
 * files are type-checked, but their Lumen diagnostics belong to their own check). The compiler's
 * diagnostics are built in ({@link compilerDiagnostics}).
 */
export type DiagnosticProvider = (context: {
  root: string;
  /** The checked tsconfig (absolute). */
  project?: string;
  files: readonly ShadowFile[];
}) => Promise<readonly FileDiagnostics[]> | readonly FileDiagnostics[];

export interface CheckOptions {
  /** Project root (contains `src/` and the tsconfig). */
  root: string;
  /** tsconfig path, relative to `root`. Default `tsconfig.json`. */
  project?: string;
  providers?: readonly DiagnosticProvider[];
}

export interface CheckResult {
  diagnostics: CheckDiagnostic[];
  summary: CheckSummary;
  /** Source texts by root-relative path, for code frames. */
  sources: Map<string, SourceText>;
}

/** Runs the check. Throws {@link CheckFailure} when the tool cannot run. */
export async function check(options: CheckOptions): Promise<CheckResult> {
  const root = realRoot(options.root);
  const project = resolve(root, options.project ?? "tsconfig.json");
  if (!existsSync(project)) {
    throw new CheckFailure(`No tsconfig at ${project}.`, {
      help: `Create it with the Lumen defaults:\n${formatTsconfig()}`,
    });
  }

  const sources = new Map<string, SourceText>();
  const diagnostics: CheckDiagnostic[] = [];
  const fileKey = (file: string) => relative(root, file).split(sep).join("/");

  // Route diagnostics depend on the project's default mode (a `server` endpoint may take POST).
  const { manifest } = await typegen(root, await routeOptions(root));
  diagnostics.push(...manifest.diagnostics.map(fromAppDiagnostic));

  const { files, layout } = await syncShadows(root, { project: relative(root, project) });
  const byShadow = new Map(files.map((file) => [file.shadow, file]));
  const own = files.filter((file) => file.own);
  for (const file of own) {
    const key = fileKey(file.source);
    const text = new SourceText(file.text);
    sources.set(key, text);
    for (const diagnostic of file.scan.diagnostics) {
      diagnostics.push(fromCompilerDiagnostic(key, text, diagnostic));
    }
  }

  const { tsc } = resolveTypeScript(root);
  const [config, run] = await Promise.all([
    showConfig(tsc, project, root),
    runTsc(tsc, ["--noEmit", "-p", project, "--pretty", "false"], root),
  ]);

  const projectKey = fileKey(project);
  const projectText = await loadText(project);
  sources.set(projectKey, projectText);
  if (config) {
    const unshadowedPackages = [];
    for (const dir of layout.outside) {
      const stsx = await listFiles(dir, (name) => name.endsWith(".stsx"), dir);
      if (stsx.length > 0) unshadowedPackages.push(dir);
    }
    const problems = tsconfigProblems(config, {
      root,
      project,
      shadows: own.map((file) => file.shadow),
      routeTypes: join(root, ROUTE_TYPES_FILE),
      layout,
      unshadowedPackages,
    });
    diagnostics.push(
      ...problems.map((problem) => tsconfigWarning(projectKey, projectText, problem)),
    );
  }

  const tscDiagnostics = parseTscOutput(run.output);
  if (run.exitCode !== 0 && tscDiagnostics.length === 0) {
    throw new CheckFailure(`TypeScript exited with code ${run.exitCode} without diagnostics.`, {
      help: run.output.trim() || undefined,
    });
  }
  for (const diagnostic of tscDiagnostics) {
    diagnostics.push(await fromTsc(diagnostic));
  }

  for (const provider of [compilerDiagnostics, ...(options.providers ?? [])]) {
    for (const { file, diagnostics: fileDiagnostics } of await provider({
      root,
      project,
      files: own,
    })) {
      const key = fileKey(resolve(root, file));
      const text = sources.get(key) ?? (await loadText(resolve(root, file)));
      sources.set(key, text);
      for (const diagnostic of fileDiagnostics) {
        diagnostics.push(fromCompilerDiagnostic(key, text, diagnostic));
      }
    }
  }

  const normalized = normalizeDiagnostics(dropSuperseded(diagnostics));
  return { diagnostics: normalized, summary: summarize(normalized), sources };

  async function fromTsc(diagnostic: TscDiagnostic): Promise<CheckDiagnostic> {
    const severity = diagnostic.category === "message" ? "hint" : diagnostic.category;
    if (diagnostic.file === undefined) {
      // Global diagnostics (options, type libraries) come from the configuration.
      return {
        source: "ts",
        code: diagnostic.code,
        severity,
        file: projectKey,
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
        message: diagnostic.message,
      };
    }
    const printed = resolve(root, diagnostic.file);
    const shadowed = byShadow.get(printed);
    const file = shadowed?.source ?? sourcePathForShadow(root, printed, layout) ?? printed;
    const key = fileKey(file);
    let text = sources.get(key);
    if (!text) {
      text = await loadText(file);
      sources.set(key, text);
    }
    const line = diagnostic.line!;
    const column = diagnostic.column!;
    const island = islandPropProblem(diagnostic.message);
    if (island) return islandDiagnostic(key, text, text.offsetAt({ line, column }), island);
    const end = text.positionAt(text.tokenEnd(text.offsetAt({ line, column })));
    // A position past the known text (a source that changed or vanished) gets an empty range.
    const valid = end.line > line || (end.line === line && end.column >= column);
    return {
      source: "ts",
      code: diagnostic.code,
      severity,
      file: key,
      line,
      column,
      endLine: valid ? end.line : line,
      endColumn: valid ? end.column : column,
      message: diagnostic.message,
    };
  }
}

export interface CheckCommandOptions extends CheckOptions {
  format?: "human" | "json";
  /** Colors for the human format. */
  color?: boolean;
  write?: (text: string) => void;
  writeError?: (text: string) => void;
}

/** `lumen check`: prints the report and returns the exit code (0 ok, 1 errors, 2 tool failure). */
export async function checkCommand(options: CheckCommandOptions): Promise<number> {
  const write = options.write ?? ((text: string) => void process.stdout.write(text));
  const writeError = options.writeError ?? ((text: string) => void process.stderr.write(text));
  const json = options.format === "json";
  try {
    const result = await check(options);
    const report: CheckReport = { diagnostics: result.diagnostics, summary: result.summary };
    write(
      json
        ? formatJson(report)
        : formatHuman(report, { sources: result.sources, color: options.color ?? false }),
    );
    return result.summary.errors > 0 ? EXIT_PROBLEMS : EXIT_OK;
  } catch (error) {
    const failure = {
      message: error instanceof Error ? error.message : String(error),
      ...(error instanceof CheckFailure && error.help !== undefined ? { help: error.help } : {}),
    };
    if (json) {
      write(formatJson({ diagnostics: [], summary: summarize([]), failure }));
    } else {
      writeError(
        `lumen check failed: ${failure.message}\n${failure.help ? `${failure.help}\n` : ""}`,
      );
      if (!(error instanceof CheckFailure) && error instanceof Error && error.stack) {
        writeError(`${error.stack}\n`);
      }
    }
    return EXIT_FAILURE;
  }
}

/** A TypeScript error on an island call site as LUM4002, on the prop when it can be found. */
function islandDiagnostic(
  file: string,
  text: SourceText,
  offset: number,
  problem: IslandPropProblem,
): CheckDiagnostic {
  const range = (problem.prop !== undefined &&
    islandPropRange(text.text, offset, problem.prop)) || {
    start: offset,
    end: text.tokenEnd(offset),
  };
  const start = text.positionAt(range.start);
  const end = text.positionAt(range.end);
  return {
    source: "lumen",
    code: LUM_ISLAND_PROP,
    severity: "error",
    file,
    line: start.line,
    column: start.column,
    endLine: end.line,
    endColumn: end.column,
    ...islandPropMessage(problem),
    docs: `errors/${LUM_ISLAND_PROP}`,
  };
}

/** A tsconfig problem as a warning at the option's key, or at the top when the key is absent. */
function tsconfigWarning(
  file: string,
  text: SourceText,
  problem: TsconfigProblem,
): CheckDiagnostic {
  const index = text.text.indexOf(`"${problem.option}"`);
  const start = text.positionAt(Math.max(index, 0));
  const end = text.positionAt(index === -1 ? 0 : index + problem.option.length + 2);
  return {
    source: "lumen",
    code: LUM_TSCONFIG,
    severity: "warning",
    file,
    line: start.line,
    column: start.column,
    endLine: end.line,
    endColumn: end.column,
    message: problem.message,
    help: problem.help,
  };
}

async function loadText(file: string): Promise<SourceText> {
  return new SourceText(await readFile(file, "utf8").catch(() => ""));
}

/** The real path: tsc prints paths relative to its real working directory. */
function realRoot(root: string): string {
  try {
    return realpathSync(resolve(root));
  } catch (cause) {
    throw new CheckFailure(`Project root ${resolve(root)} does not exist.`, { cause });
  }
}
