// Attribute serialization for compiled server code (contract doc-2 §3). Each helper returns a
// string hole that starts with a space, or "" when nothing is rendered.

import { currentFrame, resolveUnit } from "./frame.ts";
import { escapeAttr } from "./node.ts";

/** ` name="escaped"`, ` name` for `true`, "" for null/undefined/false and functions (handlers). */
export function attr(name: string, value: unknown): string {
  if (value == null || value === false || typeof value === "function") return "";
  if (value === true) return ` ${name}`;
  return ` ${name}="${escapeAttr(typeof value === "string" ? value : String(value))}"`;
}

/** ` class="…"` from a string, an array or a `Record<string, boolean>` (combinable). */
export function classAttr(value: unknown): string {
  const classes = classString(value);
  return classes === "" ? "" : ` class="${escapeAttr(classes)}"`;
}

function classString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null || typeof value !== "object") return "";
  let out = "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const name = classString(item);
      if (name !== "") out = out === "" ? name : `${out} ${name}`;
    }
    return out;
  }
  for (const key of Object.keys(value)) {
    if ((value as Record<string, unknown>)[key]) out = out === "" ? key : `${out} ${key}`;
  }
  return out;
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

// Keys that never become attributes: content, refs, keys and compile-time directives.
const SKIPPED = new Set([
  "children",
  "ref",
  "key",
  "innerHTML",
  "textContent",
  "attach",
  "$$scope",
]);
// A valid attribute name with nothing that could close the tag or start another attribute.
const ATTRIBUTE_NAME = /^[^\s"'<>/=\p{Cc}]+$/u;

/** `{...props}` on an element. Event handlers, directives and invalid names are skipped. */
export function spreadAttrs(props: Record<string, unknown>): string {
  let out = "";
  for (const key of Object.keys(props)) {
    if (SKIPPED.has(key) || key.includes(":") || /^on[A-Z]/.test(key)) continue;
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
