// `lumiose check` output: human-readable code frames, or a stable JSON document (`--format json`).

import { styleText } from "node:util";
import type { Failure } from "../output.ts";
import type { CheckDiagnostic, CheckSummary } from "./diagnostics.ts";
import type { SourceText } from "./text.ts";

/**
 * The `--format json` document, in the CLI envelope (`command`, `ok`). Stable: fields are only ever
 * added. `failure` is present only when the tool itself failed (exit code 2).
 */
export interface CheckReport {
  /** `check` or `lint`. */
  command?: string;
  /** No errors and no failure (exit code 0). */
  ok?: boolean;
  diagnostics: CheckDiagnostic[];
  summary: CheckSummary;
  /** Remarks on the run (present when there are some), e.g. type errors hidden by syntax errors. */
  notes?: string[];
  failure?: Failure;
}

export function formatJson(report: CheckReport, command = report.command ?? "check"): string {
  const document: CheckReport = {
    command,
    ok: report.failure === undefined && report.summary.errors === 0,
    diagnostics: report.diagnostics.map((diagnostic) => ({
      source: diagnostic.source,
      code: diagnostic.code,
      severity: diagnostic.severity,
      file: diagnostic.file,
      line: diagnostic.line,
      column: diagnostic.column,
      endLine: diagnostic.endLine,
      endColumn: diagnostic.endColumn,
      message: diagnostic.message,
      ...(diagnostic.help === undefined ? {} : { help: diagnostic.help }),
      ...(diagnostic.docs === undefined ? {} : { docs: diagnostic.docs }),
    })),
    summary: report.summary,
    ...(report.notes === undefined || report.notes.length === 0 ? {} : { notes: report.notes }),
    ...(report.failure === undefined ? {} : { failure: report.failure }),
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

export interface HumanFormatOptions {
  /** Source texts by root-relative path, for code frames. */
  sources?: ReadonlyMap<string, SourceText>;
  color?: boolean;
}

/** tsc-like headers with code frames, then a summary line. */
export function formatHuman(report: CheckReport, options: HumanFormatOptions = {}): string {
  const paint = (format: Parameters<typeof styleText>[0], text: string) =>
    options.color ? styleText(format, text, { validateStream: false }) : text;
  const blocks = report.diagnostics.map((diagnostic) => {
    const severity = paint(SEVERITY_COLORS[diagnostic.severity], diagnostic.severity);
    const lines = [
      `${paint("cyan", diagnostic.file)}:${paint("yellow", `${diagnostic.line}:${diagnostic.column}`)} - ${severity} ${paint("gray", diagnostic.code)}: ${diagnostic.message}`,
    ];
    const text = options.sources?.get(diagnostic.file);
    if (text) {
      const underline = (s: string) => paint(SEVERITY_COLORS[diagnostic.severity], s);
      lines.push("", ...codeFrame(text, diagnostic, underline));
    }
    if (diagnostic.help || diagnostic.docs) lines.push("");
    if (diagnostic.help) lines.push(`  ${paint("bold", "help:")} ${diagnostic.help}`);
    if (diagnostic.docs) lines.push(`  ${paint("bold", "docs:")} lumiose docs ${diagnostic.docs}`);
    return `${lines.join("\n")}\n`;
  });
  const notes = (report.notes ?? []).map((note) => `${paint("bold", "note:")} ${note}\n`);
  return [...blocks, summaryLine(report.summary) + notes.join("")].join("\n");
}

const SEVERITY_COLORS = { error: "red", warning: "yellow", hint: "blue" } as const;

/** The diagnostic's first line with a `~` underline; tabs are kept so the underline aligns. */
function codeFrame(
  text: SourceText,
  diagnostic: CheckDiagnostic,
  paint: (s: string) => string,
): string[] {
  const source = text.lineText(diagnostic.line);
  const gutter = String(diagnostic.line);
  const start = Math.min(diagnostic.column - 1, source.length);
  const end = diagnostic.endLine === diagnostic.line ? diagnostic.endColumn - 1 : source.length;
  const indent = source.slice(0, start).replace(/[^\t]/g, " ");
  const underline = "~".repeat(Math.max(1, Math.min(end, source.length) - start));
  return [`${gutter} | ${source}`, `${" ".repeat(gutter.length)} | ${indent}${paint(underline)}`];
}

function summaryLine(summary: CheckSummary): string {
  if (summary.errors + summary.warnings + summary.hints === 0) return "No problems found.\n";
  const counts = [
    plural(summary.errors, "error"),
    plural(summary.warnings, "warning"),
    summary.hints > 0 ? plural(summary.hints, "hint") : undefined,
  ].filter((part) => part !== undefined);
  return `Found ${counts.join(", ")} in ${plural(summary.files, "file")}.\n`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
