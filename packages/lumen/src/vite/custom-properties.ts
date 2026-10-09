// The project-wide `LUM3012` check (TASK-62): a custom property set in a `style` prop that no
// stylesheet of the project reads with `var()`. A per-file check gives false positives (a child
// component or global CSS often reads what a parent sets), so `compile()` only reports what each
// file sets and reads (`meta.customProperties`); this collects them with the `var()` reads of
// plain stylesheets and reports once every module is compiled (the end of `lumen build`).
// `lumen check` can feed it the same data.

import type { CompileResult, CustomPropertySet } from "@lumen/compiler";

export interface UnreadCustomProperty {
  /** The file that sets it. */
  file: string;
  /** The name, including `--`. */
  name: string;
  /** UTF-16 offsets of the name as written. */
  start: number;
  end: number;
  /** 1-based line and 0-based column of `start`. */
  line: number;
  column: number;
}

/** The names a stylesheet reads with `var()`, including fallbacks (`var(--a, var(--b))`). */
export function cssReads(code: string): string[] {
  return [...code.matchAll(/\bvar\(\s*(--[\w-]+)/g)].map((match) => match[1]!);
}

export class CustomPropertyCheck {
  /** File → source and the properties its `style` props set (the latest compile wins). */
  readonly #set = new Map<string, { source: string; set: readonly CustomPropertySet[] }>();
  /** Stylesheet (or Lumen module) → the names it reads. */
  readonly #read = new Map<string, readonly string[]>();

  /** A compiled Lumen module. A compile without CSS keeps the reads of an earlier one. */
  module(file: string, source: string, result: CompileResult): void {
    // Optional for a native binding built before TASK-62 (a stale `@lumen/compiler`).
    const meta = result.meta.customProperties as
      | CompileResult["meta"]["customProperties"]
      | undefined;
    if (meta === undefined) return;
    const { set, read } = meta;
    if (set.length > 0) this.#set.set(file, { source, set });
    else this.#set.delete(file);
    if (result.css !== null) this.#read.set(file, read);
  }

  /** A stylesheet that is not a Lumen module's (`.css`, Sass, …), by its source code. */
  stylesheet(id: string, code: string): void {
    this.#read.set(id, cssReads(code));
  }

  /** The properties no stylesheet reads, by file and then position. */
  unread(): UnreadCustomProperty[] {
    const read = new Set([...this.#read.values()].flat());
    const unread: UnreadCustomProperty[] = [];
    const files = [...this.#set].toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    for (const [file, { source, set }] of files) {
      for (const { name, span } of set) {
        if (read.has(name)) continue;
        const before = source.slice(0, span.start);
        const line = before.split("\n").length;
        const column = span.start - (before.lastIndexOf("\n") + 1);
        unread.push({ file, name, start: span.start, end: span.end, line, column });
      }
    }
    return unread;
  }
}

/** The `LUM3012` message (as `lumen/vite` prints diagnostics: code, message, help). */
export function unreadMessage(name: string): string {
  return (
    `LUM3012: \`${name}\` is set in a \`style\` prop, but no stylesheet of the project reads it ` +
    `with \`var(${name})\`\nhelp: Read it with \`var(${name})\` in a \`<style>\` block or a ` +
    `stylesheet, or remove it`
  );
}
