// `style` props under `lumiose({ csp: "strict" })` (spec §7.4, decision-78): a strict policy refuses
// `style="…"` attributes, so the server writes each style prop as a rule of a nonce'd `<style>`,
// `[data-l-v="N"]:not(#a#b){…}`, and the element gets ` data-l-v="N"`.
//
// - Precedence (TASK-521). `:not(#a#b)` matches every element (none has two ids) and weighs two
//   ids, so the rule wins over the class and attribute selectors of scoped rules, as an inline
//   style does. It stays a normal declaration, not `!important`: animations and `!important` rules
//   still win over it, as over an inline style, and so do the styles the client sets through the
//   CSSOM (inline) once the element hydrates.
// - Size (TASK-521). Identical declarations share one rule within a response.
// - Isolation (TASK-472, TASK-497). A value cannot close the rule or the `<style>` (braces, `<` and
//   backslashes are escaped), and what it leaves open is closed at its end so it cannot swallow the
//   rules after it. A value whose tokens are uncertain gets a `<style>` of its own.

import { FLUSHED, type RenderState, type Unit, resolveUnit } from "./frame.ts";

/** The `data-l-v` id of the rule with declarations `css` (non-empty) for an element of `unit`. */
export function strictStyle(render: RenderState, unit: Unit, css: string): number {
  const known = render.styleRules.get(css);
  if (known !== undefined && isPlaced(unit, known.unit)) return known.id;
  const id = render.nextStyle++;
  render.styleRules.set(css, { id, unit });
  const escaped = css.replace(/[{}<\\]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `);
  const closed = closeOpen(escaped);
  const rule = `[data-l-v="${id}"]:not(#a#b){${closed ?? escaped}}`;
  if (closed === undefined) unit.isolatedStyles.push(rule);
  else unit.styles.push(rule);
  return id;
}

/**
 * Whether the rules of `owner` are in the document by the time an element of `unit` is: `owner`
 * is `unit` or one of the units it streams inside (a boundary flushes after its parent, and is
 * dropped with it), or it was flushed already. Units folded since resolve to their parent.
 */
function isPlaced(unit: Unit, owner: Unit): boolean {
  const target = resolveUnit(owner);
  if (target.state === FLUSHED) return true;
  for (
    let at: Unit | undefined = unit;
    at !== undefined;
    at = at.parent && resolveUnit(at.parent)
  ) {
    if (at === target) return true;
  }
  return false;
}

// Whitespace and the punctuation that is always a token of its own: after them, `url(` starts a
// token in every CSS tokenizer. Not `#`, `@`, `-`, `_`, letters, digits, escapes, non-ASCII or
// control characters, which start or continue an identifier, hash, at-keyword or dimension
// (`éurl(` and `\7b url(` are functions, `#url(` a hash and a block), with differences between
// tokenizers (non-ASCII identifier characters, `U+…` unicode ranges in WebKit).
const SEPARATOR = /[\t\n\f\r !"$%&'()*+,./:;=>?[\]^`|~]/;
const NEWLINE = /[\n\f\r]/;

/**
 * `css` with the comment, string, `url(` and brackets it leaves open closed at its end, as the CSS
 * tokenizer reads them: an unclosed `/*` or `url(x` would run into the next rules of the same
 * `<style>`, and those elements would lose their styles (TASK-472). Undefined when a `url(` follows
 * anything but a separator (TASK-497): whether it opens a url token (where `/*` and quotes start
 * nothing) or a function is not certain, so the rule gets a `<style>` of its own. Its only
 * backslashes are the caller's hex escapes, each ended by a space.
 */
function closeOpen(css: string): string | undefined {
  if (!/[/"'([]/.test(css)) return css;
  const closers: string[] = [];
  let quote = "";
  let url = false;
  let comment = false;
  // Whether a token starts here (the value starts right after the rule's `{`).
  let start = true;
  for (let i = 0; i < css.length; i++) {
    const char = css[i]!;
    if (comment) {
      if (char === "*" && css[i + 1] === "/") {
        comment = false;
        start = true;
        i++;
      }
    } else if (char === "\\") {
      while (/[\da-f]/i.test(css[i + 1] ?? "")) i++;
      if (css[i + 1] === " ") i++;
      start = false;
    } else if (quote !== "") {
      // A newline ends a string too (a bad string).
      if (char === quote || NEWLINE.test(char)) {
        quote = "";
        start = true;
      }
    } else if (url) {
      if (char === ")") {
        url = false;
        start = true;
      }
    } else if (char === "/" && css[i + 1] === "*") {
      comment = true;
      i++;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if ((char === "u" || char === "U") && /^url\(/i.test(css.slice(i, i + 4))) {
      if (!start) return undefined;
      i += 3;
      // With an unquoted argument, `url(` is one url token up to `)`; with a quoted one, a function.
      if (/^[\t\n\f\r ]*["']/.test(css.slice(i + 1))) closers.push(")");
      else url = true;
      start = true;
    } else {
      if (char === "(") closers.push(")");
      else if (char === "[") closers.push("]");
      else if ((char === ")" || char === "]") && closers.at(-1) === char) closers.pop();
      start = SEPARATOR.test(char);
    }
  }
  const open = comment ? "*/" : quote !== "" ? quote : url ? ")" : "";
  return open === "" && closers.length === 0 ? css : css + open + closers.toReversed().join("");
}
