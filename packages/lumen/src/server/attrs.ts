// Attribute serialization for compiled server code (contract doc-2 §3). Each helper returns a
// string hole that starts with a space, or "" when nothing is rendered.

import { currentFrame, resolveUnit } from "./frame.ts";
import { escapeAttr } from "./node.ts";

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
 * (` name`) for `true` and omitted for `false`.
 */
export function attr(name: string, value: unknown): string {
  if (value == null || typeof value === "function") return "";
  if (typeof value === "boolean") {
    if (BOOLEANISH.test(name)) return ` ${name}="${value}"`;
    return value ? ` ${name}` : "";
  }
  return ` ${name}="${escapeAttr(typeof value === "string" ? value : String(value))}"`;
}

/** ` class="…"` from a string, an array or a `Record<string, boolean>` (combinable), as `setClass`. */
export function classAttr(value: unknown): string {
  const classes = classString(value);
  return classes === "" ? "" : ` class="${escapeAttr(classes)}"`;
}

// The client's class tokens (setClass): whitespace-separated, each once, in first-seen order.
function classString(value: unknown): string {
  const tokens: string[] = [];
  addTokens(value, tokens);
  return tokens.join(" ");
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
 * With `strictStyles` (CSP strict mode, spec §7.4) it emits a ` data-l-v="N"` hook instead and
 * records a `[data-l-v="N"]{…}` rule, flushed in a nonce'd `<style>` with the chunk.
 */
export function styleAttr(value: unknown): string {
  const css = styleString(value);
  if (css === "") return "";
  const render = currentFrame()?.render;
  if (render === undefined || !render.strictStyles) return ` style="${escapeAttr(css)}"`;
  const id = render.nextStyle++;
  // Braces and "<" are escaped so a value cannot close the rule or the <style> element.
  const safe = css.replace(/[{}<\\]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `);
  resolveUnit(currentFrame()!.unit).styles.push(`[data-l-v="${id}"]{${safe}}`);
  return ` data-l-v="${id}"`;
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
// Event handlers (`onClick`, `on:custom`) and directives. Other namespaced names (`xlink:href`,
// `xml:lang`) are attributes, as on the client.
const NOT_ATTRIBUTE = /^(?:on[A-Z]|on:|bind:|client:)/;
// A valid attribute name with nothing that could close the tag or start another attribute.
const ATTRIBUTE_NAME = /^[^\s"'<>/=\p{Cc}]+$/u;

/** `{...props}` on an element. Event handlers, directives and invalid names are skipped. */
export function spreadAttrs(props: Record<string, unknown>): string {
  let out = "";
  for (const key of Object.keys(props)) {
    if (SKIPPED.has(key) || NOT_ATTRIBUTE.test(key)) continue;
    const value = props[key];
    if (key === "class") out += classAttr(value);
    else if (key === "style") out += styleAttr(value);
    else if (ATTRIBUTE_NAME.test(key)) out += attr(key, value);
  }
  const scope = props.$$scope;
  if (typeof scope === "string") {
    for (const token of scope.split(" ")) {
      if (token !== "" && ATTRIBUTE_NAME.test(token)) out += ` ${token}`;
    }
  }
  return out;
}
