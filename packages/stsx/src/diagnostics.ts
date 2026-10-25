// Compiler diagnostics as Vite errors and warnings: the code, the message and its help, the
// position (`file:line:column`) and a code frame, so the dev overlay and build output show where.

import type { Diagnostic } from "@lumiose/compiler";
import type { Rollup } from "vite";

export interface Position {
  /** 1-based. */
  line: number;
  /** 0-based, in UTF-16 code units (as spans are). */
  column: number;
}

/** The line and column of a UTF-16 offset of `source`. */
export function positionOf(source: string, offset: number): Position {
  let line = 1;
  let lineStart = 0;
  for (let i = source.indexOf("\n"); i !== -1 && i < offset; i = source.indexOf("\n", i + 1)) {
    line++;
    lineStart = i + 1;
  }
  return { line, column: offset - lineStart };
}

/** Two lines of context around `position`, with a caret under the column. */
export function codeFrame(source: string, position: Position): string {
  const lines = source.split("\n");
  const first = Math.max(1, position.line - 2);
  const last = Math.min(lines.length, position.line + 2);
  const width = String(last).length;
  const out: string[] = [];
  for (let n = first; n <= last; n++) {
    const text = (lines[n - 1] ?? "").replace(/\r$/, "");
    out.push(`${n === position.line ? ">" : " "} ${String(n).padStart(width)} | ${text}`);
    if (n === position.line) out.push(`  ${" ".repeat(width)} | ${" ".repeat(position.column)}^`);
  }
  return out.join("\n");
}

/** A diagnostic as a Rollup log, with its location and code frame. */
export function toLog(file: string, source: string, diagnostic: Diagnostic): Rollup.RollupLog {
  const position = positionOf(source, diagnostic.span.start);
  const help = diagnostic.help === undefined ? "" : `\n${diagnostic.help}`;
  return {
    message: `${diagnostic.code} ${diagnostic.message} (${file}:${position.line}:${position.column + 1})${help}`,
    code: diagnostic.code,
    id: file,
    loc: { file, line: position.line, column: position.column },
    frame: codeFrame(source, position),
  };
}
