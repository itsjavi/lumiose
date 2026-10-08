// CSS features for `.stsx` style blocks (spec §9.2) via `vscode-css-languageservice`, run on the
// per-block virtual CSS documents. Those keep source offsets, so results need no position mapping.

import { getCSSLanguageService } from "vscode-css-languageservice";
import type {
  Color,
  ColorInformation,
  ColorPresentation,
  CompletionList,
  Diagnostic,
  DocumentHighlight,
  FoldingRange,
  Hover,
  Position,
  Range,
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

export function cssDiagnostics(snapshot: StsxSnapshot): Diagnostic[] {
  return snapshot.cssBlocks.flatMap((css) =>
    (cssService.doValidation(css.document, css.stylesheet) as Diagnostic[]).map((diagnostic) => ({
      ...diagnostic,
      source: "css",
    })),
  );
}

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
