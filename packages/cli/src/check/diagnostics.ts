// The `lumiose check` diagnostic model: one flat, stable shape for TypeScript and Lumiose
// diagnostics, with 1-based lines and UTF-16 columns (what tsc and editors report).

import type { Diagnostic as CompilerDiagnostic } from "@lumiose/compiler";
import type { AppDiagnostic } from "lumiose/internal/app/diagnostics.ts";
import type { SourceText } from "./text.ts";

export type DiagnosticSource = "ts" | "lumiose" | "oxlint" | "stylelint";
export type DiagnosticSeverity = "error" | "warning" | "hint";

export interface CheckDiagnostic {
  source: DiagnosticSource;
  /** `TS2322`, `LUM3010`, `eslint(no-debugger)`, `color-no-invalid-hex`, … */
  code: string;
  severity: DiagnosticSeverity;
  /** Root-relative POSIX path (`../` for files outside the project root). */
  file: string;
  /** 1-based. */
  line: number;
  /** 1-based, in UTF-16 code units. */
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  help?: string;
  /** Docs topic, e.g. `errors/LUM3010` (`lumiose docs <topic>`). */
  docs?: string;
  /** A machine-applicable fix (Lumiose diagnostics that have one). */
  fix?: CheckFix;
}

/** A fix: text edits with the same 1-based positions as diagnostics, applied together. */
export interface CheckFix {
  message: string;
  edits: { line: number; column: number; endLine: number; endColumn: number; text: string }[];
}

export interface CheckSummary {
  errors: number;
  warnings: number;
  hints: number;
  /** Number of distinct files with diagnostics. */
  files: number;
}

/** A failure of the tool itself (not of the checked code): `lumiose check` exits with 2. */
export class CheckFailure extends Error {
  readonly help: string | undefined;

  constructor(message: string, options: { help?: string; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "CheckFailure";
    this.help = options.help;
  }
}

/** Converts a compiler-shaped diagnostic (UTF-16 span) of `file` into the check shape. */
export function fromCompilerDiagnostic(
  file: string,
  text: SourceText,
  diagnostic: CompilerDiagnostic,
): CheckDiagnostic {
  const start = text.positionAt(diagnostic.span.start);
  const end = text.positionAt(Math.max(diagnostic.span.end, diagnostic.span.start));
  return {
    source: "lumiose",
    code: diagnostic.code,
    severity: diagnostic.severity,
    file,
    line: start.line,
    column: start.column,
    endLine: end.line,
    endColumn: end.column,
    message: diagnostic.message,
    ...(diagnostic.help === undefined ? {} : { help: diagnostic.help }),
    docs: diagnostic.docs,
    ...(diagnostic.fix === undefined
      ? {}
      : {
          fix: {
            message: diagnostic.fix.message,
            edits: diagnostic.fix.edits.map((edit) => {
              const editStart = text.positionAt(edit.span.start);
              const editEnd = text.positionAt(edit.span.end);
              return {
                line: editStart.line,
                column: editStart.column,
                endLine: editEnd.line,
                endColumn: editEnd.column,
                text: edit.text,
              };
            }),
          },
        }),
  };
}

/** Converts a route-manifest diagnostic (whole file, no position) into the check shape. */
export function fromAppDiagnostic(diagnostic: AppDiagnostic): CheckDiagnostic {
  return {
    source: "lumiose",
    code: diagnostic.code,
    severity: diagnostic.severity,
    file: diagnostic.file,
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
    message: diagnostic.message,
    ...(diagnostic.help === undefined ? {} : { help: diagnostic.help }),
    docs: `errors/${diagnostic.code}`,
  };
}

/**
 * Lumiose codes on a `$` reference that a TypeScript error inside the reference supersedes: for an
 * unknown name both would fire, and TypeScript's message ("Did you mean …?") is the actionable one.
 */
export const SUPERSEDED_BY_TYPESCRIPT: ReadonlySet<string> = new Set(["LUM3008"]);

/** Drops {@link SUPERSEDED_BY_TYPESCRIPT} diagnostics whose range holds a TypeScript error's start. */
export function dropSuperseded(diagnostics: CheckDiagnostic[]): CheckDiagnostic[] {
  const errors = diagnostics.filter((d) => d.source === "ts" && d.severity === "error");
  return diagnostics.filter(
    (d) =>
      !(d.source === "lumiose" && SUPERSEDED_BY_TYPESCRIPT.has(d.code)) ||
      !errors.some(
        (error) =>
          error.file === d.file &&
          comparePositions(error.line, error.column, d.line, d.column) >= 0 &&
          comparePositions(error.line, error.column, d.endLine, d.endColumn) < 0,
      ),
  );
}

/**
 * Drops TypeScript diagnostics inside a raw-CSS `<style>` block of a `.tsx` file (LUM1006, from its
 * `<style` tag to the next `</style>`): TypeScript reads the CSS as JSX text and reports noise
 * ("'}' expected") that renaming the file to `.stsx` removes.
 */
export function dropInsideRawCss(
  diagnostics: CheckDiagnostic[],
  sources: ReadonlyMap<string, SourceText>,
): CheckDiagnostic[] {
  const blocks = diagnostics.flatMap((d) => {
    const text = d.source === "lumiose" && d.code === "LUM1006" ? sources.get(d.file) : undefined;
    if (!text) return [];
    const start = text.offsetAt({ line: d.line, column: d.column });
    const close = text.text.indexOf("</style>", start);
    const end = close === -1 ? text.text.length : close + "</style>".length;
    return [{ file: d.file, start: text.positionAt(start), end: text.positionAt(end) }];
  });
  if (blocks.length === 0) return diagnostics;
  return diagnostics.filter(
    (d) =>
      d.source !== "ts" ||
      !blocks.some(
        (block) =>
          block.file === d.file &&
          comparePositions(d.line, d.column, block.start.line, block.start.column) >= 0 &&
          comparePositions(d.line, d.column, block.end.line, block.end.column) < 0,
      ),
  );
}

function comparePositions(line: number, column: number, otherLine: number, otherColumn: number) {
  return line - otherLine || column - otherColumn;
}

/** Sorts by file, position, source and code, dropping exact duplicates (same code and range). */
export function normalizeDiagnostics(diagnostics: CheckDiagnostic[]): CheckDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.toSorted(compareDiagnostics).filter((diagnostic) => {
    const key = [
      diagnostic.file,
      diagnostic.line,
      diagnostic.column,
      diagnostic.endLine,
      diagnostic.endColumn,
      diagnostic.code,
      diagnostic.message,
    ].join("\0");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function summarize(diagnostics: CheckDiagnostic[]): CheckSummary {
  const count = (severity: DiagnosticSeverity) =>
    diagnostics.filter((diagnostic) => diagnostic.severity === severity).length;
  return {
    errors: count("error"),
    warnings: count("warning"),
    hints: count("hint"),
    files: new Set(diagnostics.map((diagnostic) => diagnostic.file)).size,
  };
}

function compareDiagnostics(a: CheckDiagnostic, b: CheckDiagnostic): number {
  return (
    compareStrings(a.file, b.file) ||
    a.line - b.line ||
    a.column - b.column ||
    compareStrings(a.source, b.source) ||
    compareStrings(a.code, b.code) ||
    compareStrings(a.message, b.message)
  );
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
