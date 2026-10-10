// The CSS of `.stsx` style blocks as CSS tools see it: each `$` reference replaced by a CSS
// identifier of the same length (`$radius.lg` → `_radius_lg`, spec §4.6.4), so positions and line
// widths are unchanged.

import type { Span, StyleBlock } from "@lumiose/compiler";

/** The same-length identifier of a reference: `$radius.lg` → `_radius_lg`. */
export function refIdentifier(ref: string): string {
  return ref.replace(/[^\w-]/g, "_");
}

/**
 * The whole source blanked (line breaks kept) except one block's CSS, with its references
 * replaced: offsets, lines and columns are the source's.
 */
export function virtualCss(text: string, block: StyleBlock): string {
  const { start, end } = block.content;
  let content = text.slice(start, end);
  for (const ref of block.refs) {
    const from = ref.span.start - start;
    const to = ref.span.end - start;
    content = content.slice(0, from) + refIdentifier(content.slice(from, to)) + content.slice(to);
  }
  return blank(text.slice(0, start)) + content + blank(text.slice(end));
}

function blank(text: string): string {
  return text.replace(/[^\r\n]/g, " ");
}

export interface ProtectedCss {
  /** The CSS with each reference replaced by a unique same-length identifier. */
  css: string;
  /** Puts the references back into a reformatted `css`; `undefined` if one went missing. */
  restore(formatted: string): string | undefined;
}

/**
 * Protects references (spans relative to `css`) for a CSS formatter. Each distinct reference gets
 * an identifier of its own length that does not occur elsewhere in the block, so restoring is a
 * plain whole-identifier replacement whatever the formatter moved.
 */
export function protectRefs(css: string, refs: readonly Span[]): ProtectedCss {
  const byRef = new Map<string, string>();
  const used = new Set<string>();
  let out = "";
  let last = 0;
  for (const span of refs) {
    const ref = css.slice(span.start, span.end);
    let placeholder = byRef.get(ref);
    if (placeholder === undefined) {
      placeholder = uniqueIdentifier(
        ref,
        (candidate) => used.has(candidate) || css.includes(candidate),
      );
      byRef.set(ref, placeholder);
      used.add(placeholder);
    }
    out += css.slice(last, span.start) + placeholder;
    last = span.end;
  }
  out += css.slice(last);

  const refsByPlaceholder = new Map([...byRef].map(([ref, placeholder]) => [placeholder, ref]));
  return {
    css: out,
    restore(formatted) {
      if (refsByPlaceholder.size === 0) return formatted;
      const pattern = new RegExp(
        `(?<![\\w-])(?:${[...refsByPlaceholder.keys()].join("|")})(?![\\w-])`,
        "g",
      );
      let count = 0;
      const restored = formatted.replace(pattern, (placeholder) => {
        count++;
        return refsByPlaceholder.get(placeholder)!;
      });
      return count === refs.length ? restored : undefined;
    },
  };
}

/** `_name_member`, else variants ending in base-36 counters (`_nam0`, `_nam1`, …). */
function uniqueIdentifier(ref: string, taken: (candidate: string) => boolean): string {
  const base = refIdentifier(ref);
  if (!taken(base)) return base;
  for (let attempt = 0; ; attempt++) {
    const suffix = attempt.toString(36);
    if (suffix.length >= base.length) throw new Error(`No free identifier for ${ref}.`);
    const candidate = base.slice(0, base.length - suffix.length) + suffix;
    if (!taken(candidate)) return candidate;
  }
}
