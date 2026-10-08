// Offset <-> line/column conversion in UTF-16 code units. Line breaks match TypeScript's
// (`\r\n`, `\r`, `\n`, U+2028, U+2029), so positions agree with `tsc` and editors.

/** A 1-based line and a 1-based column counted in UTF-16 code units. */
export interface Position {
  line: number;
  column: number;
}

export class SourceText {
  readonly text: string;
  readonly #starts: number[];

  constructor(text: string) {
    this.text = text;
    this.#starts = lineStarts(text);
  }

  get lineCount(): number {
    return this.#starts.length;
  }

  positionAt(offset: number): Position {
    const clamped = Math.max(0, Math.min(offset, this.text.length));
    let low = 0;
    let high = this.#starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.#starts[mid]! <= clamped) low = mid;
      else high = mid - 1;
    }
    return { line: low + 1, column: clamped - this.#starts[low]! + 1 };
  }

  offsetAt({ line, column }: Position): number {
    const start = this.#starts[Math.max(0, Math.min(line - 1, this.#starts.length - 1))]!;
    return Math.min(start + column - 1, this.lineEnd(line));
  }

  /** The text of a 1-based line, without its terminator. */
  lineText(line: number): string {
    const start = this.#starts[line - 1];
    if (start === undefined) return "";
    return this.text.slice(start, this.lineEnd(line));
  }

  /**
   * End offset of the token starting at `offset`: an identifier, a quoted string on the same line,
   * or a single character. `tsc --pretty false` reports only start positions, so this
   * approximates the diagnostic's range (exact for names, members and literals).
   */
  tokenEnd(offset: number): number {
    const text = this.text;
    const first = text[offset];
    if (first === undefined) return offset;
    if (IDENTIFIER.test(first)) {
      let end = offset + 1;
      while (end < text.length && IDENTIFIER.test(text[end]!)) end++;
      return end;
    }
    if (first === '"' || first === "'" || first === "`") {
      const lineEnd = this.lineEnd(this.positionAt(offset).line);
      for (let end = offset + 1; end < lineEnd; end++) {
        if (text[end] === "\\") end++;
        else if (text[end] === first) return end + 1;
      }
    }
    return offset + 1;
  }

  lineEnd(line: number): number {
    const next = this.#starts[line];
    if (next === undefined) return this.text.length;
    // Every later line start follows exactly one terminator: `\r\n` or a single character.
    return this.text[next - 1] === "\n" && this.text[next - 2] === "\r" ? next - 2 : next - 1;
  }
}

const IDENTIFIER = /[\p{ID_Continue}$‌‍]/u;

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 13) {
      if (text.charCodeAt(i + 1) === 10) i++;
      starts.push(i + 1);
    } else if (code === 10 || code === 0x2028 || code === 0x2029) {
      starts.push(i + 1);
    }
  }
  return starts;
}
