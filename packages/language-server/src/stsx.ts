// One version of an `.stsx` document: the scanner result (masked TSX, style blocks), one virtual
// CSS document per block and the class index. Everything keeps the source's UTF-16 offsets, so
// positions pass between the source, the shadow TSX and the virtual CSS unchanged (spec §4.1).

import { scan, type ScanResult, type StyleBlock, type StyleRef } from "@lumen/compiler";
import type { Stylesheet } from "vscode-css-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";
import { classAttributes, selectorClasses, type ClassAttributes } from "./classes.ts";
import { cssService } from "./css.ts";

export interface CssBlock {
  index: number;
  block: StyleBlock;
  /** The virtual CSS: the whole file blanked except this block's content. */
  document: TextDocument;
  stylesheet: Stylesheet;
}

export interface SelectorClass {
  name: string;
  start: number;
  end: number;
  /** Index of the block in {@link StsxSnapshot.blocks}. */
  block: number;
}

/** Offsets of a top-level declaration (a component), used to scope component blocks. */
export interface OffsetRange {
  start: number;
  end: number;
}

export class StsxSnapshot {
  readonly document: TextDocument;
  readonly scan: ScanResult;
  #css: CssBlock[] | undefined;
  #selectors: SelectorClass[] | undefined;
  #attributes: ClassAttributes | undefined;
  /** Top-level declaration ranges, filled from TypeScript's document symbols on demand. */
  components: Promise<OffsetRange[] | undefined> | undefined;

  constructor(document: TextDocument, filename: string) {
    this.document = document;
    this.scan = scan(document.getText(), filename);
  }

  get blocks(): readonly StyleBlock[] {
    return this.scan.blocks;
  }

  /** The block whose CSS content contains `offset` (both ends inclusive). */
  blockAt(offset: number): { index: number; block: StyleBlock } | undefined {
    const index = this.scan.blocks.findIndex(
      (block) => block.content.start <= offset && offset <= block.content.end,
    );
    return index === -1 ? undefined : { index, block: this.scan.blocks[index]! };
  }

  /** The `$` reference whose span contains `offset` (both ends inclusive). */
  refAt(block: StyleBlock, offset: number): StyleRef | undefined {
    return block.refs.find((ref) => ref.span.start <= offset && offset <= ref.span.end);
  }

  /** Whether `offset` lies inside any block, tags included. */
  inBlock(offset: number): StyleBlock | undefined {
    return this.scan.blocks.find((block) => block.span.start <= offset && offset < block.span.end);
  }

  get cssBlocks(): CssBlock[] {
    this.#css ??= this.scan.blocks.map((block, index) => {
      const document = TextDocument.create(
        this.document.uri,
        "css",
        this.document.version,
        virtualCss(this.document.getText(), block),
      );
      return { index, block, document, stylesheet: cssService.parseStylesheet(document) };
    });
    return this.#css;
  }

  cssBlockAt(offset: number): CssBlock | undefined {
    const at = this.blockAt(offset);
    return at && this.cssBlocks[at.index];
  }

  get selectors(): SelectorClass[] {
    this.#selectors ??= this.cssBlocks.flatMap(({ index, block, document }) =>
      selectorClasses(document.getText(), block.content.start, block.content.end).map(
        (occurrence) => ({ ...occurrence, block: index }),
      ),
    );
    return this.#selectors;
  }

  get classAttributes(): ClassAttributes {
    this.#attributes ??= classAttributes(this.scan.masked);
    return this.#attributes;
  }
}

/**
 * The virtual CSS of one block: same length as the source, everything outside the block content
 * blanked (line breaks kept), and each `$` reference replaced by a CSS identifier of the same
 * length (`$radius.lg` → `_radius_lg`, spec §4.6.4).
 */
export function virtualCss(text: string, block: StyleBlock): string {
  const { start, end } = block.content;
  let content = text.slice(start, end);
  for (const ref of block.refs) {
    const from = ref.span.start - start;
    const to = ref.span.end - start;
    content =
      content.slice(0, from) + content.slice(from, to).replace(/[^\w-]/g, "_") + content.slice(to);
  }
  return blank(text.slice(0, start)) + content + blank(text.slice(end));
}

function blank(text: string): string {
  return text.replace(/[^\r\n]/g, " ");
}

/**
 * Blocks visible from a position: global and file-level blocks, plus the component blocks of the
 * top-level declaration containing `offset` (spec §4.6.1). Without declaration ranges, all blocks.
 */
export function visibleBlocks(
  snapshot: StsxSnapshot,
  components: readonly OffsetRange[] | undefined,
  offset: number,
): Set<number> {
  const visible = new Set<number>();
  const component = components && componentAt(components, offset);
  snapshot.blocks.forEach((block, index) => {
    if (
      components === undefined ||
      block.placement !== "jsx" ||
      componentAt(components, block.span.start) === component
    ) {
      visible.add(index);
    }
  });
  return visible;
}

export function componentAt(
  components: readonly OffsetRange[],
  offset: number,
): OffsetRange | undefined {
  return components.find((range) => range.start <= offset && offset < range.end);
}
