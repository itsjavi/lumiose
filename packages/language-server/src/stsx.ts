// One version of an `.stsx` document: the scanner result (masked TSX, style blocks), one virtual
// CSS document per block and the class index. Everything keeps the source's UTF-16 offsets, so
// positions pass between the source, the shadow TSX and the virtual CSS unchanged (spec §4.1).

import { scan, type ScanResult, type StyleBlock, type StyleRef } from "@lumiose/compiler";
import type { Stylesheet } from "vscode-css-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";
import { classAttributes, selectorClasses, type ClassAttributes } from "./classes.ts";
import { cssService } from "./css.ts";
import { jsxStructure, type JsxElement, type JsxStructure } from "./jsx.ts";

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

/** A half-open offset range. */
export interface OffsetRange {
  start: number;
  end: number;
}

/**
 * Where a block's CSS applies within its file (decision-23): a nested block's enclosing element
 * and everything written inside it (`range`); `undefined` for file-level and global blocks, and
 * blocks in expressions (misplaced), which apply to the whole file.
 */
export interface BlockScope extends OffsetRange {
  /** The enclosing element; unset when it could not be read (an unclosed element while typing). */
  element?: JsxElement;
}

export class StsxSnapshot {
  readonly document: TextDocument;
  readonly scan: ScanResult;
  #css: CssBlock[] | undefined;
  #selectors: SelectorClass[] | undefined;
  #attributes: ClassAttributes | undefined;
  #jsx: JsxStructure | undefined;
  #scopes: Array<BlockScope | undefined> | undefined;

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

  get jsx(): JsxStructure {
    this.#jsx ??= jsxStructure(this.scan.masked);
    return this.#jsx;
  }

  /** Each block's scope, by block index. */
  get scopes(): ReadonlyArray<BlockScope | undefined> {
    this.#scopes ??= this.scan.blocks.map((block) => {
      if (block.global || block.placement !== "jsx" || !block.parent) return undefined;
      const element = this.jsx.elementAt(block.parent.span.start);
      if (element) return { start: element.start, end: element.end, element };
      // Unreadable structure: from the parent's `<` to the end of the file.
      const lt = this.scan.masked.lastIndexOf("<", block.parent.span.start);
      return { start: Math.max(lt, 0), end: this.scan.masked.length };
    });
    return this.#scopes;
  }

  /** Whether block `index` applies at `offset`. */
  visibleAt(index: number, offset: number): boolean {
    const scope = this.scopes[index];
    return scope === undefined || (scope.start <= offset && offset < scope.end);
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
