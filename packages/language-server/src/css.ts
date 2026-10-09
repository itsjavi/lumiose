// CSS features for `.stsx` style blocks (spec §9.2) via `vscode-css-languageservice`, run on the
// per-block virtual CSS documents. Those keep source offsets, so results need no position mapping.

import { getCSSLanguageService } from "vscode-css-languageservice";
import {
  SymbolKind,
  type Color,
  type ColorInformation,
  type ColorPresentation,
  type CompletionList,
  type Diagnostic,
  type DocumentHighlight,
  type DocumentSymbol,
  type FoldingRange,
  type Hover,
  type Position,
  type Range,
  type SymbolInformation,
} from "vscode-languageserver";
import type { CssBlock, StsxSnapshot } from "./stsx.ts";

export const cssService = getCSSLanguageService();
cssService.configure({ validate: true });

export function cssCompletion(css: CssBlock, position: Position): CompletionList {
  return cssService.doComplete(css.document, position, css.stylesheet, {
    completePropertyWithSemicolon: true,
    triggerPropertyValueCompletion: true,
  }) as CompletionList;
}

export function cssHover(css: CssBlock, position: Position): Hover | null {
  return cssService.doHover(css.document, position, css.stylesheet) as Hover | null;
}

export function cssHighlights(css: CssBlock, position: Position): DocumentHighlight[] {
  return cssService.findDocumentHighlights(
    css.document,
    position,
    css.stylesheet,
  ) as DocumentHighlight[];
}

/**
 * The CSS service's diagnostics for the style blocks, without those that a Lumen CSS diagnostic
 * (`lumen`, the compiler's) already reports: an unknown property (LUM3020), an empty value
 * (LUM3017) on the same line, and a missing `}` (LUM3014) in the same block.
 */
export function cssDiagnostics(
  snapshot: StsxSnapshot,
  lumen: readonly Diagnostic[] = [],
): Diagnostic[] {
  return snapshot.cssBlocks.flatMap((css) => {
    const start = snapshot.document.positionAt(css.block.span.start).line;
    const end = snapshot.document.positionAt(css.block.span.end).line;
    const inBlock = lumen.filter((d) => d.range.start.line >= start && d.range.start.line <= end);
    return (cssService.doValidation(css.document, css.stylesheet) as Diagnostic[])
      .filter((diagnostic) => {
        const lumenCode = SUPERSEDED_BY_LUMEN[String(diagnostic.code)];
        if (lumenCode === undefined) return true;
        return !inBlock.some(
          (d) =>
            d.code === lumenCode &&
            (lumenCode === "LUM3014" || d.range.start.line === diagnostic.range.start.line),
        );
      })
      .map((diagnostic) => ({ ...diagnostic, source: "css" }));
  });
}

/** CSS service codes, and the Lumen CSS diagnostic that reports the same problem. */
const SUPERSEDED_BY_LUMEN: Readonly<Record<string, string>> = {
  unknownProperties: "LUM3020",
  "css-propertyvalueexpected": "LUM3017",
  "css-rcurlyexpected": "LUM3014",
};

export function cssColors(snapshot: StsxSnapshot): ColorInformation[] {
  return snapshot.cssBlocks.flatMap(
    (css) => cssService.findDocumentColors(css.document, css.stylesheet) as ColorInformation[],
  );
}

export function cssColorPresentations(
  snapshot: StsxSnapshot,
  color: Color,
  range: Range,
): ColorPresentation[] {
  const css = snapshot.cssBlockAt(snapshot.document.offsetAt(range.start));
  if (!css) return [];
  return cssService.getColorPresentations(
    css.document,
    css.stylesheet,
    color,
    range,
  ) as ColorPresentation[];
}

/** Folding inside blocks, plus one range per multi-line block (`<style>` through `</style>`). */
export function cssFoldingRanges(snapshot: StsxSnapshot): FoldingRange[] {
  const ranges: FoldingRange[] = [];
  for (const css of snapshot.cssBlocks) {
    const start = snapshot.document.positionAt(css.block.span.start).line;
    const end = snapshot.document.positionAt(css.block.span.end).line;
    if (end > start) ranges.push({ startLine: start, endLine: end - 1 });
    ranges.push(...(cssService.getFoldingRanges(css.document) as FoldingRange[]));
  }
  return ranges;
}

/** One symbol per style block, named by its open tag (`<style global>`), holding its rules. */
export function cssDocumentSymbols(snapshot: StsxSnapshot): DocumentSymbol[] {
  const text = snapshot.document.getText();
  return snapshot.cssBlocks.map(({ block, document, stylesheet }) => ({
    name: blockName(text, block.openTag),
    detail: block.global
      ? "global"
      : block.placement === "jsx"
        ? `<${block.parent?.name ?? ""}> subtree`
        : "file",
    kind: SymbolKind.Namespace,
    range: blockRange(snapshot, block.span.start, block.span.end),
    selectionRange: blockRange(snapshot, block.openTag.start, block.openTag.end),
    children: cssService.findDocumentSymbols2(document, stylesheet) as DocumentSymbol[],
  }));
}

/** Flat symbols (clients without hierarchical symbols): rules contained by their block's tag. */
export function cssSymbolInformation(snapshot: StsxSnapshot): SymbolInformation[] {
  const text = snapshot.document.getText();
  return snapshot.cssBlocks.flatMap(({ block, document, stylesheet }) => {
    const name = blockName(text, block.openTag);
    return [
      {
        name,
        kind: SymbolKind.Namespace,
        location: {
          uri: snapshot.document.uri,
          range: blockRange(snapshot, block.span.start, block.span.end),
        },
      },
      ...(cssService.findDocumentSymbols(document, stylesheet) as SymbolInformation[]).map(
        (symbol) => ({ ...symbol, containerName: name }),
      ),
    ];
  });
}

/** Inserts each symbol into the innermost symbol containing it, keeping siblings in order. */
export function mergeDocumentSymbols(
  symbols: DocumentSymbol[],
  extra: readonly DocumentSymbol[],
): DocumentSymbol[] {
  for (const symbol of extra) insertSymbol(symbols, symbol);
  return symbols;
}

function insertSymbol(siblings: DocumentSymbol[], symbol: DocumentSymbol): void {
  const parent = siblings.find((candidate) => contains(candidate.range, symbol.range));
  if (parent) {
    insertSymbol((parent.children ??= []), symbol);
    return;
  }
  const index = siblings.findIndex((s) => comparePositions(s.range.start, symbol.range.start) > 0);
  siblings.splice(index === -1 ? siblings.length : index, 0, symbol);
}

function contains(outer: Range, inner: Range): boolean {
  return (
    comparePositions(outer.start, inner.start) <= 0 && comparePositions(inner.end, outer.end) <= 0
  );
}

function comparePositions(a: Position, b: Position): number {
  return a.line - b.line || a.character - b.character;
}

function blockName(text: string, openTag: { start: number; end: number }): string {
  return text.slice(openTag.start, openTag.end).replace(/\s+/g, " ");
}

function blockRange(snapshot: StsxSnapshot, start: number, end: number): Range {
  return { start: snapshot.document.positionAt(start), end: snapshot.document.positionAt(end) };
}
