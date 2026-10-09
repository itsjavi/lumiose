// Dev error reporting: SSR failures shown in Vite's error overlay, with a code frame of the user's
// source. Compiler diagnostics already carry Vite's `loc`/`frame` (lumen/vite's `this.error`);
// runtime errors get a frame from the first stack frame in the project (stacks of modules run by
// Vite's module runner are source-mapped).

import { readFileSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { jsonForScript } from "../../server/node.ts";

/** The error shape Vite's `ErrorOverlay` renders (`ErrorPayload["err"]`). */
export interface OverlayError {
  message: string;
  stack: string;
  id?: string;
  frame?: string;
  plugin?: string;
  loc?: { file: string; line: number; column: number };
}

interface ViteErrorFields {
  id?: unknown;
  frame?: unknown;
  plugin?: unknown;
  loc?: { file?: unknown; line?: unknown; column?: unknown };
}

// `at name (/path/file:1:2)` or `at /path/file:1:2`; paths may contain parentheses (route groups).
const STACK_LOCATION = /^at (?:.*? \()?((?:file:\/\/)?(?:\/|[A-Za-z]:[\\/]).*?):(\d+):(\d+)\)?$/;

/** Prepares a thrown value for the overlay (and the terminal). */
export function overlayError(error: unknown, root: string): OverlayError {
  const err = error instanceof Error ? error : new Error(String(error));
  const fields = err as Error & ViteErrorFields;
  const out: OverlayError = { message: err.message, stack: cleanStack(err) };
  if (typeof fields.plugin === "string") out.plugin = fields.plugin;
  if (typeof fields.id === "string") out.id = fields.id;
  if (typeof fields.frame === "string") out.frame = stripAnsi(fields.frame);
  const loc = fields.loc;
  if (
    loc !== undefined &&
    typeof loc.line === "number" &&
    typeof loc.column === "number" &&
    (typeof loc.file === "string" || out.id !== undefined)
  ) {
    out.loc = {
      file: (loc.file as string | undefined) ?? out.id!,
      line: loc.line,
      column: loc.column,
    };
  }
  if (out.loc === undefined) {
    const at = projectFrame(err.stack ?? "", root);
    if (at !== undefined) {
      out.loc = at;
      out.id ??= at.file;
      if (out.frame === undefined) {
        const frame = codeFrameOf(at.file, at.line, at.column);
        if (frame !== undefined) out.frame = frame;
      }
    }
  }
  return out;
}

/** A terminal message: the error, its location and frame, then the stack. */
export function formatError(error: OverlayError, root: string): string {
  let text = error.plugin === undefined ? error.message : `[${error.plugin}] ${error.message}`;
  if (error.loc !== undefined) {
    const file = isAbsolute(error.loc.file) ? relative(root, error.loc.file) : error.loc.file;
    text += `\n  at ${file}:${error.loc.line}:${error.loc.column}`;
  }
  if (error.frame !== undefined) text += `\n${error.frame}`;
  if (error.stack !== "") text += `\n${error.stack}`;
  return text;
}

/**
 * A module script that opens Vite's error overlay with `errors[0]` (the others are in the
 * terminal). Appended to HTML responses whose render reported errors.
 */
export function overlayScript(errors: readonly OverlayError[], base: string): string {
  const [first, ...rest] = errors;
  if (first === undefined) return "";
  const shown =
    rest.length === 0
      ? first
      : { ...first, message: `${first.message}\n(+${rest.length} more; see the terminal)` };
  return (
    `<script type="module">import { ErrorOverlay } from ${JSON.stringify(`${base}@vite/client`)};` +
    `document.body.appendChild(new ErrorOverlay(${jsonForScript(shown)}));</script>`
  );
}

/** A code frame around `line:column` (1-based) of `file`, Vite-style. */
export function codeFrame(source: string, line: number, column: number): string {
  const lines = source.split(/\r?\n/);
  const start = Math.max(1, line - 2);
  const end = Math.min(lines.length, line + 2);
  const width = String(end).length;
  const out: string[] = [];
  for (let n = start; n <= end; n++) {
    out.push(`${String(n).padStart(width)}  |  ${lines[n - 1] ?? ""}`);
    if (n === line) out.push(`${" ".repeat(width)}  |  ${" ".repeat(Math.max(0, column - 1))}^`);
  }
  return out.join("\n");
}

function codeFrameOf(file: string, line: number, column: number): string | undefined {
  try {
    return codeFrame(readFileSync(file, "utf8"), line, column);
  } catch {
    return undefined;
  }
}

/** The first stack frame in a project source file (not node_modules, not the framework). */
function projectFrame(
  stack: string,
  root: string,
): { file: string; line: number; column: number } | undefined {
  for (const line of stack.split("\n").slice(1)) {
    const match = STACK_LOCATION.exec(line.trim());
    if (match === null) continue;
    const raw = match[1]!.replace(/\?.*$/, "");
    // `file:///C:/x` and `C:\x` alike: the native path, compared separator- and drive-case-agnostic.
    const file = raw.startsWith("file://") ? fileURLToPath(raw) : raw;
    if (!isInside(file, root) || /[\\/]node_modules[\\/]/.test(file)) continue;
    return { file, line: Number(match[2]), column: Number(match[3]) };
  }
  return undefined;
}

/** Whether `file` is below `root`, whatever their separators (`C:\\a` and `c:/a/b` match). */
function isInside(file: string, root: string): boolean {
  return pathKey(file).startsWith(`${pathKey(root)}/`);
}

/** A path with `/` separators, without a trailing one, lowercased when it has a drive letter. */
function pathKey(path: string): string {
  const slashed = path.replaceAll("\\", "/").replace(/\/+$/, "");
  return /^[A-Za-z]:\//.test(slashed) ? slashed.toLowerCase() : slashed;
}

/** The stack without its first line (the message, which the overlay shows separately). */
function cleanStack(error: Error): string {
  const stack = error.stack ?? "";
  const at = stack.indexOf("\n    at ");
  return at === -1 ? "" : stripAnsi(stack.slice(at + 1));
}

function stripAnsi(text: string): string {
  // oxlint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}
