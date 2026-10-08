// SSR nodes and escaping (spec §6.4: string concatenation with fused escaping).
//
// Hole protocol for `ssr()` (contract doc-2 §3): holes come from the runtime helpers.
// - A string hole is HTML that a helper already escaped or serialized (`attr`, `text`, `insert`…).
// - An `SSRHtml` node is rendered HTML (`ssr`, components, `list`, `branch`, `island`).
// - A thenable resolves to one of the above.
// Values that reach content positions (`insert`, component results, children) go through
// `content()`, which escapes plain strings as text. Nodes are branded instances, so user data
// shaped like `{ t: "<script>" }` is never mistaken for HTML.

import type { SSRNode } from "../contract/server.ts";

/** Already-escaped HTML (the contract's `SSRNode`). */
export class SSRHtml implements SSRNode {
  readonly t: string;

  constructor(value: string) {
    this.t = value;
  }
}

/** A dynamic text hole inside an island: `ssr()` separates adjacent ones with `<!--!-->`. */
export class TextHole extends SSRHtml {}

export type Html = string | Promise<string>;

export function html(value: Html): SSRHtml | Promise<SSRHtml> {
  return typeof value === "string" ? new SSRHtml(value) : value.then(toNode);
}

function toNode(value: string): SSRHtml {
  return new SSRHtml(value);
}

/** Joins HTML pieces in order; async only when a piece is a promise. */
export function join(pieces: readonly Html[]): Html {
  let out = "";
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]!;
    if (typeof piece !== "string") {
      return Promise.all(pieces).then((all) => all.join(""));
    }
    out += piece;
  }
  return out;
}

/** Wraps HTML between two strings, keeping it sync when possible. */
export function wrap(open: string, inner: Html, close: string): Html {
  return typeof inner === "string"
    ? open + inner + close
    : inner.then((value) => open + value + close);
}

export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

// --- Escaping ----------------------------------------------------------------------------------

// Only the characters the HTML tokenizer acts on are escaped (as Solid, Svelte and Marko do): `&`
// (character references) and `<` (tags, and the end tag of `<title>`/`<textarea>`) in text, `&` and
// `"` in double-quoted attribute values. `>` and `'` parse as themselves there, so the DOM is the
// same as with the client's text and attribute writes (./parity.test.ts).

/** Escapes text content: `&` and `<`. */
export function escapeText(value: string): string {
  return escapeWith(value, "<", "&lt;");
}

/** Escapes a double-quoted attribute value: `&` and `"`. */
export function escapeAttr(value: string): string {
  return escapeWith(value, '"', "&quot;");
}

// The hot path of server rendering: `indexOf` scans (vectorized by V8) find the next `&` and the
// next `delimiter`; unchanged runs are sliced, and a string with neither is returned as is.
function escapeWith(value: string, delimiter: string, entity: string): string {
  let amp = value.indexOf("&");
  let delim = value.indexOf(delimiter);
  if (amp < 0 && delim < 0) return value;
  let out = "";
  let from = 0;
  while (amp >= 0 || delim >= 0) {
    if (delim < 0 || (amp >= 0 && amp < delim)) {
      out += from === amp ? "&amp;" : value.slice(from, amp) + "&amp;";
      from = amp + 1;
      amp = value.indexOf("&", from);
    } else {
      out += from === delim ? entity : value.slice(from, delim) + entity;
      from = delim + 1;
      delim = value.indexOf(delimiter, from);
    }
  }
  return from < value.length ? out + value.slice(from) : out;
}

/** Escapes a value for text (default) or double-quoted attribute context. Nullish and booleans render nothing. */
export function escape(value: unknown, attribute?: boolean): string {
  if (value == null || typeof value === "boolean") return "";
  const text = typeof value === "string" ? value : String(value);
  return attribute === true ? escapeAttr(text) : escapeText(text);
}

/** Serializes data for a `<script type="application/json">`: `<` cannot open `</script>` or `<!--`. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
