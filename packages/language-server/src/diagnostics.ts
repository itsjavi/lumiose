// Lumen diagnostics as LSP diagnostics, and filtering of TypeScript diagnostics on the shadow.

import type { Diagnostic as CompilerDiagnostic, StyleBlock } from "@lumen/compiler";
import {
  CodeActionKind,
  DiagnosticSeverity,
  type CodeAction,
  type Diagnostic,
  type Range,
} from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

/** Converts a compiler-shaped diagnostic (UTF-16 span) of `document` to an LSP diagnostic. */
export function toLspDiagnostic(
  document: TextDocument,
  diagnostic: CompilerDiagnostic,
): Diagnostic {
  return {
    range: spanRange(document, diagnostic.span),
    severity:
      diagnostic.severity === "error"
        ? DiagnosticSeverity.Error
        : diagnostic.severity === "warning"
          ? DiagnosticSeverity.Warning
          : DiagnosticSeverity.Hint,
    code: diagnostic.code,
    source: "lumen",
    message:
      diagnostic.help === undefined
        ? diagnostic.message
        : `${diagnostic.message}\n${diagnostic.help}`,
    ...(diagnostic.labels.length > 0
      ? {
          relatedInformation: diagnostic.labels.map((label) => ({
            location: { uri: document.uri, range: spanRange(document, label.span) },
            message: label.message,
          })),
        }
      : {}),
  };
}

/** Quick fixes for compiler diagnostics that carry a fix and overlap `range`. */
export function lumenQuickFixes(
  document: TextDocument,
  diagnostics: readonly CompilerDiagnostic[],
  range: Range,
): CodeAction[] {
  const from = document.offsetAt(range.start);
  const to = document.offsetAt(range.end);
  return diagnostics.flatMap((diagnostic) => {
    const { fix } = diagnostic;
    if (!fix || diagnostic.span.end < from || diagnostic.span.start > to) return [];
    return [
      {
        title: fix.message,
        kind: CodeActionKind.QuickFix,
        diagnostics: [toLspDiagnostic(document, diagnostic)],
        isPreferred: true,
        edit: {
          changes: {
            [document.uri]: fix.edits.map((edit) => ({
              range: spanRange(document, edit.span),
              newText: edit.text,
            })),
          },
        },
      },
    ];
  });
}

/**
 * Drops TypeScript diagnostics inside style blocks (noise from the masked `;ref;` / `{ref}`
 * statements), except those on a `$` reference, which are real errors in the reference (an
 * unknown name or member).
 */
export function filterBlockDiagnostics<T extends { range: Range }>(
  document: TextDocument,
  blocks: readonly StyleBlock[],
  diagnostics: readonly T[],
): T[] {
  return diagnostics.filter((diagnostic) => {
    const offset = document.offsetAt(diagnostic.range.start);
    const block = blocks.find((b) => b.span.start <= offset && offset < b.span.end);
    return !block || block.refs.some((ref) => ref.span.start <= offset && offset < ref.span.end);
  });
}

/** Whether an edit's range touches a style block (formatting the masked text would erase CSS). */
export function touchesBlock(
  document: TextDocument,
  blocks: readonly StyleBlock[],
  range: Range,
): boolean {
  const from = document.offsetAt(range.start);
  const to = document.offsetAt(range.end);
  return blocks.some((block) => from < block.span.end && to > block.span.start);
}

function spanRange(document: TextDocument, span: { start: number; end: number }): Range {
  return {
    start: document.positionAt(span.start),
    end: document.positionAt(Math.max(span.start, span.end)),
  };
}
