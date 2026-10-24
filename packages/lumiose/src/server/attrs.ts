// Attribute serialization for compiled server code (contract doc-2 §3). Each helper returns a
// string hole that starts with a space, or "" when nothing is rendered.

import { currentFrame, resolveUnit } from "./frame.ts";
import { escapeAttr } from "./node.ts";
import { strictStyle } from "./strict-styles.ts";
import { safeAttrValue } from "../dom/url.ts";

/**
 * Attributes whose boolean values are written as "true"/"false" instead of present/absent:
 * `aria-*` and the enumerated (`Booleanish`) attributes of HTML, SVG and MathML. A copy of the
 * client table in ../dom/attributes.ts (client parity rule, TASK-13); ./parity.test.ts keeps the
 * two in sync.
 */
export const BOOLEANISH =
  /^(?:aria-|(?:contenteditable|draggable|spellcheck|writingsuggestions|preserveAlpha|displaystyle|accent|accentunder|fence|largeop|movablelimits|separator|stretchy|symmetric)$)/;

/**
 * ` name="escaped"`, or "" for null/undefined and functions (handlers). Booleans follow the client
 * `setAttr`: `aria-*` and enumerated attributes get "true"/"false"; other attributes are present
 * (` name`) for `true` and omitted for `false`. `custom`: the element is a custom element (the
 * compiler passes `true` for a tag with a dash): objects and arrays are left out, as in React 19,
 * since the client sets them as properties when the island hydrates (TASK-337).
 */
export function attr(name: string, value: unknown, custom?: boolean): string {
  if (value == null || typeof value === "function" || (custom && typeof value === "object")) {
    return "";
  }
  if (typeof value === "boolean") {
    if (BOOLEANISH.test(name)) return ` ${name}="${value}"`;
    return value ? ` ${name}` : "";
  }
  // Unsafe URLs in URL attributes become a placeholder, as on the client (../dom/url.ts).
  const text = safeAttrValue(name, typeof value === "string" ? value : String(value));
  return ` ${name}="${escapeAttr(text)}"`;
}

/** ` class="…"` from a string, an array or a `Record<string, boolean>` (combinable), as `setClass`. */
export function classAttr(value: unknown): string {
  if (typeof value !== "string") return classOf(value);
  // Class strings repeat across rows and requests: their serialized attribute is memoized, in a
  // map that starts over once full (bounded memory for unbounded distinct values).
  let out = classCache.get(value);
  if (out === undefined) {
    out = classOf(value);
    if (classCache.size === CLASS_CACHE_SIZE) classCache.clear();
    classCache.set(value, out);
  }
  return out;
}

const CLASS_CACHE_SIZE = 512;
const classCache = new Map<string, string>();

function classOf(value: unknown): string {
  const classes = classString(value);
  return classes === "" ? "" : ` class="${escapeAttr(classes)}"`;
}

// The client's class tokens (setClass): whitespace-separated, each once, in first-seen order.
function classString(value: unknown): string {
  if (typeof value === "string" && isClassList(value)) return value;
  const tokens: string[] = [];
  addTokens(value, tokens);
  return tokens.join(" ");
}

/**
 * Whether `value` is already a normalized class list (the common case: `"row active"`): ASCII
 * tokens separated by single spaces, none repeated. Checked without allocating; anything else
 * (other whitespace, non-ASCII, duplicates, many tokens) takes the general path.
 */
function isClassList(value: string): boolean {
  const length = value.length;
  if (length === 0) return true;
  let start = 0;
  let tokens = 0;
  for (let i = 0; i <= length; i++) {
    const code = i === length ? 32 : value.charCodeAt(i);
    if (code > 32 && code < 127) continue;
    if (code !== 32 || i === start || ++tokens > 8) return false;
    // The token [start, i) against each earlier one.
    for (let other = 0; other < start;) {
      const end = value.indexOf(" ", other);
      if (end - other === i - start && sameChars(value, other, start, i - start)) return false;
      other = end + 1;
    }
    start = i + 1;
  }
  return true;
}

function sameChars(value: string, a: number, b: number, length: number): boolean {
  for (let k = 0; k < length; k++) {
    if (value.charCodeAt(a + k) !== value.charCodeAt(b + k)) return false;
  }
  return true;
}

function addTokens(value: unknown, out: string[]): void {
  if (!value) return;
  if (typeof value === "string") {
    for (const token of value.split(/\s+/)) {
      if (token !== "" && !out.includes(token)) out.push(token);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) addTokens(item, out);
  } else if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      if ((value as Record<string, unknown>)[key]) addTokens(key, out);
    }
  }
}

/**
 * ` style="…"` from a string or an object with kebab-case keys (custom properties included).
 * With `strictStyles` (CSP strict mode, spec §7.4) it emits a ` data-l-v="N"` hook instead, for a
 * rule flushed in a nonce'd `<style>` with the chunk (./strict-styles.ts).
 */
export function styleAttr(value: unknown): string {
  const css = styleString(value);
  if (css === "") return "";
  const frame = currentFrame();
  if (frame === undefined || !frame.render.strictStyles) return ` style="${escapeAttr(css)}"`;
  return ` data-l-v="${strictStyle(frame.render, resolveUnit(frame.unit), css)}"`;
}

/**
 * ` nonce="…"` for a `<script>`/`<style>` written in JSX, with `lumiose({ csp: "strict" })` on a page
 * rendered per request (decision-27); "" otherwise (prerendered pages hash them instead).
 */
export function nonceAttr(): string {
  const nonce = currentFrame()?.render.nonce;
  return nonce === undefined ? "" : ` nonce="${escapeAttr(nonce)}"`;
}

function styleString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null || typeof value !== "object") return "";
  let out = "";
  for (const key of Object.keys(value)) {
    const item = (value as Record<string, unknown>)[key];
    if (item == null || item === false || item === "") continue;
    out += `${out === "" ? "" : ";"}${key}:${String(item)}`;
  }
  return out;
}

// Keys that never become attributes: content, property-only DOM state, refs, keys and
// compile-time directives.
const SKIPPED = new Set([
  "children",
  "ref",
  "key",
  "innerHTML",
  "textContent",
  "indeterminate",
  "attach",
  "$$scope",
]);
// Event handlers (`onClick`, `on:custom`), lowercase `on*` names (an inline handler attribute is a
// script sink: dropped, as on the client and in React, TASK-165) and directives. Other namespaced
// names (`xlink:href`, `xml:lang`) are attributes, as on the client.
const NOT_ATTRIBUTE = /^on|^(?:bind|client):/i;
// An iframe's `srcdoc`, in any case (the parser lowercases attribute names): a document with the
// page's origin, which only a written prop sets, like `innerHTML` (TASK-496).
const SRCDOC = /^srcdoc$/i;
// A valid attribute name with nothing that could close the tag or start another attribute.
const ATTRIBUTE_NAME = /^[^\s"'<>/=\p{Cc}]+$/u;

/**
 * `{...props}` on an element. Event handlers, directives and invalid names are skipped; `custom`
 * as in `attr()`. A nullish spread (`{...props.extra}`) renders nothing, as on the client
 * (TASK-569).
 */
export function spreadAttrs(
  props: Record<string, unknown> | null | undefined,
  custom?: boolean,
): string {
  if (props == null) return "";
  let out = "";
  for (const key of Object.keys(props)) {
    if (SKIPPED.has(key) || NOT_ATTRIBUTE.test(key) || SRCDOC.test(key)) continue;
    const value = props[key];
    if (key === "class") out += classAttr(value);
    else if (key === "style") out += styleAttr(value);
    else if (ATTRIBUTE_NAME.test(key)) out += attr(key, value, custom);
  }
  const scope = props.$$scope;
  if (typeof scope === "string") {
    for (const token of scope.split(" ")) {
      if (token !== "" && ATTRIBUTE_NAME.test(token)) out += ` ${token}`;
    }
  }
  return out;
}
