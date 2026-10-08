// `lumen check` (spec §9.1): typegen, shadow sync, then `tsc --noEmit` on the project, with
// TypeScript positions in shadow files mapped back to their `.stsx` sources (same line and
// column), merged with scanner, route and other Lumen diagnostics.

import type { Diagnostic as CompilerDiagnostic } from "@lumen/compiler";
import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { ROUTE_TYPES_FILE, typegen } from "../../app/typegen/index.ts";
import {
  CheckFailure,
  fromCompilerDiagnostic,
  normalizeDiagnostics,
  summarize,
  type CheckDiagnostic,
  type CheckSummary,
} from "./diagnostics.ts";
import { formatHuman, formatJson, type CheckReport } from "./report.ts";
import { sourcePathForShadow, syncShadows, type ShadowFile } from "./shadow.ts";
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
export { CheckFailure } from "./diagnostics.ts";
export { formatHuman, formatJson, type CheckReport } from "./report.ts";
export {
  SHADOW_DIR,
  shadowPathFor,
  sourcePathForShadow,
  syncShadows,
  type ShadowFile,
  type SyncShadowsOptions,
  type SyncShadowsResult,
} from "./shadow.ts";
export { formatTsconfig, LUM_TSCONFIG, tsconfigTemplate } from "./tsconfig.ts";
export { parseTscOutput } from "./tsc.ts";

/** Exit codes: no errors, errors found, the tool itself failed. */
export const EXIT_OK = 0;
export const EXIT_ERRORS = 1;
export const EXIT_FAILURE = 2;

/** Compiler-shaped diagnostics (UTF-16 spans) for one absolute file path. */
export interface FileDiagnostics {
  file: string;
  diagnostics: readonly CompilerDiagnostic[];
}

/**
 * Hook for more Lumen diagnostics (the compiler's `compile()` diagnostics, lint results). It runs
 * after shadow sync; `files` holds every scanned `.stsx` with its source text and scan result.
 */
export type DiagnosticProvider = (context: {
  root: string;
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

  const { manifest } = await typegen(root);
  for (const diagnostic of manifest.diagnostics) {
    diagnostics.push({
      source: "lumen",
      code: diagnostic.code,
      severity: diagnostic.severity,
      file: diagnostic.file,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
      message: diagnostic.message,
      ...(diagnostic.help === undefined ? {} : { help: diagnostic.help }),
    });
  }

  const { files } = await syncShadows(root);
  const byShadow = new Map(files.map((file) => [file.shadow, file]));
  for (const file of files) {
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
    const problems = tsconfigProblems(config, {
      root,
      project,
      shadows: files.map((file) => file.shadow),
      routeTypes: join(root, ROUTE_TYPES_FILE),
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

  for (const provider of options.providers ?? []) {
    for (const { file, diagnostics: fileDiagnostics } of await provider({ root, files })) {
      const key = fileKey(resolve(root, file));
      const text = sources.get(key) ?? (await loadText(resolve(root, file)));
      sources.set(key, text);
      for (const diagnostic of fileDiagnostics) {
        diagnostics.push(fromCompilerDiagnostic(key, text, diagnostic));
      }
    }
  }

  const normalized = normalizeDiagnostics(diagnostics);
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
    const file = shadowed?.source ?? sourcePathForShadow(root, printed) ?? printed;
    const key = fileKey(file);
    let text = sources.get(key);
    if (!text) {
      text = await loadText(file);
      sources.set(key, text);
    }
    const line = diagnostic.line!;
    const column = diagnostic.column!;
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
    return result.summary.errors > 0 ? EXIT_ERRORS : EXIT_OK;
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
