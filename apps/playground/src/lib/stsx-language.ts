// The `.stsx` language for CodeMirror: TSX with raw-CSS `<style>` blocks, parsed the way the
// compiler sees it. The TSX parser reads a masked copy of the text in which the contents of every
// `<style>` block are blanked (offset-identical, like the compiler's scanner), so CSS braces never
// open JSX expressions; the CSS parser then overlays those ranges.

import { cssLanguage } from "@codemirror/lang-css";
import { tsxLanguage } from "@codemirror/lang-javascript";
import { Language, LanguageSupport } from "@codemirror/language";
import {
  parseMixed,
  Parser,
  type Input,
  type PartialParse,
  type TreeFragment,
} from "@lezer/common";

export interface Range {
  from: number;
  to: number;
}

const BLOCK = /<style\b(?:[^>"'{]|"[^"]*"|'[^']*'|\{[^}]*\})*>([\s\S]*?)<\/style\s*>/g;

/** The content ranges of the closed `<style>` blocks in `text`. */
export function styleRanges(text: string): Range[] {
  const ranges: Range[] = [];
  for (const match of text.matchAll(BLOCK)) {
    const from = match.index + match[0].length - match[1]!.length - closeTagLength(match[0]);
    if (match[1]!.length > 0) ranges.push({ from, to: from + match[1]!.length });
  }
  return ranges;
}

function closeTagLength(block: string): number {
  return block.length - block.lastIndexOf("</style");
}

/** `text` with the characters inside `ranges` (offset `at`) replaced by spaces, newlines kept. */
export function mask(text: string, at: number, ranges: readonly Range[]): string {
  let result = text;
  for (const range of ranges) {
    const from = Math.max(range.from - at, 0);
    const to = Math.min(range.to - at, text.length);
    if (from >= to) continue;
    result =
      result.slice(0, from) + result.slice(from, to).replace(/[^\n]/g, " ") + result.slice(to);
  }
  return result;
}

/** A parse input that reads the masked text. */
class MaskedInput implements Input {
  readonly #input: Input;
  readonly #ranges: readonly Range[];
  readonly length: number;
  readonly lineChunks: boolean;

  constructor(input: Input, ranges: readonly Range[]) {
    this.#input = input;
    this.#ranges = ranges;
    this.length = input.length;
    this.lineChunks = input.lineChunks;
  }

  chunk(from: number): string {
    return mask(this.#input.chunk(from), from, this.#ranges);
  }

  read(from: number, to: number): string {
    return mask(this.#input.read(from, to), from, this.#ranges);
  }
}

const css = cssLanguage.parser;

/** Finds the `<style>` content ranges of a source: the compiler's scanner, or {@link styleRanges}. */
export type StyleScanner = (text: string) => Range[];

class StsxParser extends Parser {
  readonly #tsx = tsxLanguage.parser;
  readonly #scan: StyleScanner;

  constructor(scan: StyleScanner) {
    super();
    this.#scan = scan;
  }

  override createParse(
    input: Input,
    fragments: readonly TreeFragment[],
    ranges: readonly Range[],
  ): PartialParse {
    const blocks = this.#scan(input.read(0, input.length));
    if (blocks.length === 0) return this.#tsx.createParse(input, fragments, ranges);
    const inner = this.#tsx.createParse(new MaskedInput(input, blocks), fragments, ranges);
    const wrap = parseMixed((node) => (node.type.isTop ? { parser: css, overlay: blocks } : null));
    return wrap(inner, input, fragments, ranges);
  }
}

/**
 * The `.stsx` language with TSX's language data (comments, brackets). `scan` finds the style
 * blocks; the default is a regular expression, the playground passes the compiler's scanner once
 * it has loaded (exact also for `<style>` inside strings and comments).
 */
export function stsx(scan: StyleScanner = styleRanges): LanguageSupport {
  return new LanguageSupport(new Language(tsxLanguage.data, new StsxParser(scan), [], "stsx"));
}
