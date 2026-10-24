// Pure DOM writers, usable as `bind` apply functions (contract doc-2 §2, spec §4.5, §4.6.2).

import { hydrator } from "./hydration.ts";
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
 * Sets or removes an attribute. Nullish, `false` and functions remove it (a function's source is
 * never an attribute, as the server's `attr` leaves it out, TASK-568) and `true` sets "", except for
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
  } else if (value == null || value === false || typeof value === "function") {
    el.removeAttribute(name);
  } else {
    // Unsafe URLs in URL attributes become a placeholder (./url.ts).
    el.setAttribute(name, value === true ? "" : safeAttrValue(name, String(value)));
  }
}

/**
 * Sets a DOM property. Nullish clears string properties (`value`) instead of writing "undefined",
 * and removes the attribute behind a number one: `<progress>` and `<meter>` throw on a non-finite
 * `value`, and without the attribute a progress bar is indeterminate again (TASK-407).
 */
export function setProp(el: Element, name: string, value: unknown): void {
  const slots = el as unknown as Slots;
  if (value != null) {
    slots[name] = value;
  } else if (typeof slots[name] === "number") {
    el.removeAttribute(name);
  } else {
    slots[name] = typeof slots[name] === "string" ? "" : value;
  }
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

/**
 * `lumiose({ csp: "strict" })` (decision-78): the server wrote a claimed element's `style` prop as a
 * `[data-l-v]` rule. Strict builds set every declaration through the CSSOM, the static ones
 * included, in the same task that claims the element, so its first style write while hydrating
 * drops the hook: a property a binding removes later is then unset, as without CSP, instead of
 * falling back to the rule's value (TASK-526).
 */
function claimStyle(el: HTMLElement | SVGElement): void {
  if (el.hasAttribute("data-l-v")) el.removeAttribute("data-l-v");
}

/** Sets one style property (kebab-case or `--custom`); nullish or `false` removes it. */
export function setStyleProperty(el: HTMLElement | SVGElement, name: string, value: unknown): void {
  if (hydrator !== undefined) claimStyle(el);
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
  if (hydrator !== undefined) claimStyle(el);
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
