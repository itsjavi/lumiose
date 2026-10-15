// Pure DOM writers, usable as `bind` apply functions (contract doc-2 §2, spec §4.5, §4.6.2).

import { safeAttrValue } from "./url.ts";

type Slots = Record<string, unknown>;

/**
 * Attributes whose boolean values are written as "true"/"false" instead of present/absent:
 * `aria-*` and the enumerated (`Booleanish`) attributes of HTML, SVG and MathML.
 */
const BOOLEANISH =
  /^(?:aria-|(?:contenteditable|draggable|spellcheck|writingsuggestions|preserveAlpha|displaystyle|accent|accentunder|fence|largeop|movablelimits|separator|stretchy|symmetric)$)/;

/** The page's CSP nonce (`<meta property="csp-nonce">`); `null` when it has none. */
let pageNonce: string | null | undefined;

/**
 * `lumiose({ csp: "strict" })`: gives a `<script>`/`<style>` created on the client the page's nonce,
 * so a strict policy applies it (TASK-142). The `nonce` property survives cloning.
 */
export function setNonce(el: HTMLElement | SVGElement): void {
  pageNonce ??=
    document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.nonce || null;
  if (pageNonce !== null && !el.nonce) el.nonce = pageNonce;
}

/** Text content: nullish and booleans render nothing, like `insert`. */
export function setText(node: Text, value: unknown): void {
  // A number goes to the DOM as is, which converts it to the same text. String() on integers grows
  // V8's number-string cache by about 64 kB once per page; no string stays alive per node (TASK-267).
  node.data =
    typeof value === "number"
      ? (value as unknown as string)
      : value == null || typeof value === "boolean"
        ? ""
        : String(value);
}

/**
 * Sets or removes an attribute. Nullish and `false` remove it and `true` sets "", except for
 * `aria-*` and enumerated attributes, where booleans are written as "true"/"false". On a custom
 * element that defines a property of that name (not one every element has), the value goes to the
 * property as it is, as in React 19: arrays, objects and booleans reach the element (TASK-326).
 */
export function setAttr(el: Element, name: string, value: unknown): void {
  if (el.localName.includes("-") && name in el && !(name in HTMLElement.prototype)) {
    // Strings keep the URL check of attributes: a custom element may pass them on to an `<a>`.
    (el as unknown as Slots)[name] = typeof value === "string" ? safeAttrValue(name, value) : value;
  } else if (typeof value === "boolean" && BOOLEANISH.test(name)) {
    el.setAttribute(name, String(value));
  } else if (value == null || value === false) {
    el.removeAttribute(name);
  } else {
    // Unsafe URLs in URL attributes become a placeholder (./url.ts).
    el.setAttribute(name, value === true ? "" : safeAttrValue(name, String(value)));
  }
}

/** Sets a DOM property. Nullish clears string properties (`value`) instead of writing "undefined". */
export function setProp(el: Element, name: string, value: unknown): void {
  const slots = el as unknown as Slots;
  slots[name] = value == null && typeof slots[name] === "string" ? "" : value;
}

function addTokens(value: unknown, out: Record<string, true>): void {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    for (const token of value.split(/\s+/)) {
      if (token) {
        out[token] = true;
      }
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      addTokens(item, out);
    }
  } else if (typeof value === "object") {
    for (const name in value) {
      if ((value as Slots)[name]) {
        addTokens(name, out);
      }
    }
  }
}

/**
 * Applies a `class` value (string, `{ name: on }` record, or nested arrays of those). Only the
 * classes this function added before are removed, so classes from other code and the scope tokens
 * (attributes, spec §4.6.2) are left alone.
 */
export function setClass(el: Element, value: unknown): void {
  const next: Record<string, true> = {};
  addTokens(value, next);
  const slots = el as unknown as Slots;
  const prev = slots.$$class as Record<string, true> | undefined;
  const list = el.classList;
  if (prev !== undefined) {
    for (const name in prev) {
      if (next[name] === undefined) {
        list.remove(name);
      }
    }
  }
  for (const name in next) {
    if (prev === undefined || prev[name] === undefined) {
      list.add(name);
    }
  }
  slots.$$class = next;
}

/**
 * Toggles one class (a static class-object key compiled to its own binding). Turning a class off on
 * an element without a `class` attribute writes nothing: new list rows then never touch (nor
 * allocate) their `classList`.
 */
export function toggleClass(el: Element, name: string, on: unknown): void {
  if (on) {
    el.classList.add(name);
  } else if (el.hasAttribute("class")) {
    el.classList.remove(name);
  }
}

/** Sets one style property (kebab-case or `--custom`); nullish or `false` removes it. */
export function setStyleProperty(el: HTMLElement | SVGElement, name: string, value: unknown): void {
  if (value == null || value === false) {
    el.style.removeProperty(name);
  } else {
    el.style.setProperty(name, String(value));
  }
}

/**
 * Applies a `style` value: a string (replaces the inline style) or an object with kebab-case keys,
 * diffed against the object applied before: only changed properties are written.
 */
export function setStyle(el: HTMLElement | SVGElement, value: unknown): void {
  const slots = el as unknown as Slots;
  const style = el.style;
  let prev = slots.$$style as Slots | string | undefined;
  if (typeof value === "string") {
    style.cssText = value;
    slots.$$style = value;
    return;
  }
  if (typeof prev === "string") {
    style.cssText = "";
    prev = undefined;
  }
  const next = value !== null && typeof value === "object" ? (value as Slots) : undefined;
  if (prev !== undefined) {
    for (const name in prev) {
      if (next === undefined || !(name in next)) {
        style.removeProperty(name);
      }
    }
  }
  if (next !== undefined) {
    for (const name in next) {
      const v = next[name];
      if (prev === undefined || v !== prev[name]) {
        setStyleProperty(el, name, v);
      }
    }
  }
  slots.$$style = next;
}

/** Class passthrough (spec §4.6.2): sets each `data-l-*` scope token as an empty attribute. */
export function applyScope(el: Element, tokens: string | undefined): void {
  if (tokens) {
    for (const token of tokens.split(" ")) {
      if (token) {
        el.setAttribute(token, "");
      }
    }
  }
}
