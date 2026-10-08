// `spread(el, () => props)`: a props object applied to an element (contract doc-2 §2).
import { renderEffect } from "../core/internal.ts";
import { applyScope, setAttr, setClass, setProp, setStyle } from "./attributes.ts";

type Props = Record<string, unknown>;
type Listener = (event: Event) => void;

/** Keys written as DOM properties; every other plain key is an attribute (HTML names, spec §4.5). */
const PROPERTIES = /^(?:value|checked|selected|muted|indeterminate|innerHTML|textContent)$/;

interface SpreadState {
  el: Element;
  prev: Props;
}

/** Reads every value (tracked). `children` is left to the caller, `key` is compile-time only. */
function readProps(props: Props): Props {
  const out: Props = {};
  for (const key in props) {
    if (key !== "children" && key !== "key") {
      out[key] = props[key];
    }
  }
  return out;
}

/** The DOM event of an `onX` or `on:x` key, or undefined. */
function eventName(key: string): string | undefined {
  if (key[0] === "o" && key[1] === "n") {
    const c = key.charCodeAt(2);
    if (c === 58) {
      return key.slice(3);
    }
    if (c >= 65 && c <= 90) {
      return key.slice(2).toLowerCase();
    }
  }
  return undefined;
}

function setSpreadProp(el: Element, key: string, value: unknown, prev: unknown): void {
  const event = eventName(key);
  if (event !== undefined) {
    // Spread handlers are native listeners: the compiler cannot see which events they use.
    if (typeof prev === "function") {
      el.removeEventListener(event, prev as Listener);
    }
    if (typeof value === "function") {
      el.addEventListener(event, value as Listener);
    }
  } else if (key === "class") {
    setClass(el, value);
  } else if (key === "style") {
    setStyle(el as HTMLElement, value);
  } else if (key === "ref") {
    (value as ((el: Element) => void) | undefined)?.(el);
  } else if (key === "$$scope") {
    applyScope(el, value as string | undefined);
  } else if (PROPERTIES.test(key)) {
    setProp(el, key, value);
  } else {
    setAttr(el, key, value);
  }
}

function applySpread(state: SpreadState, next: Props): void {
  const { el, prev } = state;
  for (const key in prev) {
    if (!(key in next)) {
      setSpreadProp(el, key, undefined, prev[key]);
    }
  }
  for (const key in next) {
    const value = next[key];
    const old = prev[key];
    if (value !== old) {
      setSpreadProp(el, key, value, old);
    }
  }
  state.prev = next;
}

/**
 * Applies attributes, properties, `class`, `style`, events (`onX`, `on:x`), `ref` and `$$scope`
 * from `props()`. Tracked: when a read value changes, only the keys that changed are written, and
 * keys that disappeared are removed.
 */
export function spread(el: Element, props: () => Props): void {
  renderEffect<SpreadState, Props>({ el, prev: {} }, () => readProps(props()), applySpread);
}
