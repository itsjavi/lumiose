// Client variants of `<Title>`, `<Meta>` and `<Head>` (spec §8 Document): they keep `document.head`
// current across SPA navigations, with the server's rules (the deepest `<Title>` wins; metas with the
// same charset/name/property/http-equiv/itemprop dedupe and the deepest wins; ties go to the latest).
// Tags already in `<head>` (rendered by the server) are adopted instead of duplicated.
import type { Renderable } from "../contract/client.ts";
import { getOwner, renderEffect } from "../core/internal.ts";
import { onCleanup } from "../core/owner.ts";
import { setAttr } from "./attributes.ts";
import { renderRange } from "./insert.ts";

interface Entry<T> {
  depth: number;
  value: T | undefined;
}

/** The deepest entry; the latest one among equals. */
function winner<T>(entries: readonly Entry<T>[]): Entry<T> | undefined {
  let best: Entry<T> | undefined;
  for (const entry of entries) {
    if (best === undefined || entry.depth >= best.depth) {
      best = entry;
    }
  }
  return best;
}

/** Adds an entry that tracks `compute` and calls `update` when it changes or goes away. */
function addEntry<T>(entries: Entry<T>[], compute: () => T, update: () => void): void {
  const entry: Entry<T> = { depth: getOwner()?.depth ?? 0, value: undefined };
  entries.push(entry);
  renderEffect(entry, compute, (target, value) => {
    target.value = value;
    update();
  });
  onCleanup(() => {
    entries.splice(entries.indexOf(entry), 1);
    update();
  });
}

function textOf(value: Renderable): string {
  while (typeof value === "function") {
    value = value();
  }
  if (value == null || typeof value === "boolean") {
    return "";
  }
  if (Array.isArray(value)) {
    return (value as readonly Renderable[]).map(textOf).join("");
  }
  return typeof value === "object" ? ((value as Node).textContent ?? "") : String(value);
}

// --- Title ---------------------------------------------------------------------------------------

const titles: Entry<string>[] = [];

function updateTitle(): void {
  const best = winner(titles);
  if (best !== undefined) {
    document.title = best.value!;
  }
}

/** Sets `document.title`. The deepest `<Title>` wins (a page overrides its layouts). */
export function Title(props: { children?: Renderable }): Renderable {
  addEntry(titles, () => textOf(props.children), updateTitle);
  return null;
}

// --- Meta ----------------------------------------------------------------------------------------

type Attributes = Record<string, unknown>;

const META_KEYS = ["charset", "name", "property", "http-equiv", "itemprop"] as const;
const metas = new Map<string, Entry<Attributes>[]>();
const metaElements = new Map<string, Element>();
let unkeyed = 0;

/** The dedupe key of a meta, or `undefined` when it has none. */
function metaKey(props: Attributes): string | undefined {
  const name = META_KEYS.find((key) => props[key] != null);
  return name === undefined
    ? undefined
    : name === "charset"
      ? name
      : `${name}:${String(props[name])}`;
}

function setAttributes(el: Element, attributes: Attributes): void {
  for (const name of el.getAttributeNames()) {
    if (!(name in attributes)) {
      el.removeAttribute(name);
    }
  }
  for (const name in attributes) {
    setAttr(el, name, attributes[name]);
  }
}

/** A `<meta>` in `<head>` with the same key (or, unkeyed, equal) that no `<Meta>` manages yet. */
function adoptMeta(key: string, attributes: Attributes): Element | undefined {
  const managed = new Set(metaElements.values());
  const probe = document.createElement("meta");
  setAttributes(probe, attributes);
  for (const el of document.head.querySelectorAll("meta")) {
    if (
      !managed.has(el) &&
      (key[0] === "#" ? el.isEqualNode(probe) : metaKey(attrsOf(el)) === key)
    ) {
      return el;
    }
  }
  return undefined;
}

function attrsOf(el: Element): Attributes {
  const out: Attributes = {};
  for (const name of el.getAttributeNames()) {
    out[name] = el.getAttribute(name);
  }
  return out;
}

function updateMeta(key: string): void {
  const best = winner(metas.get(key)!);
  let el = metaElements.get(key);
  if (best === undefined) {
    el?.remove();
    metaElements.delete(key);
    metas.delete(key);
    return;
  }
  if (el === undefined) {
    el = adoptMeta(key, best.value!) ?? document.head.appendChild(document.createElement("meta"));
    metaElements.set(key, el);
  }
  setAttributes(el, best.value!);
}

/** Adds or updates a `<meta>` in `<head>`; removed (or the next deepest restored) on disposal. */
export function Meta(props: Attributes): Renderable {
  const key = metaKey(props) ?? `#${unkeyed++}`;
  let entries = metas.get(key);
  if (entries === undefined) {
    metas.set(key, (entries = []));
  }
  addEntry(
    entries,
    () => ({ ...props }),
    () => updateMeta(key),
  );
  return null;
}

// --- Head ----------------------------------------------------------------------------------------

/**
 * Appends its children to `<head>` and removes them on disposal. Elements equal to one already in
 * `<head>` (for example rendered by the server) are skipped.
 */
export function Head(props: { children?: Renderable }): Renderable {
  const start = renderRange(() => props.children);
  const end = start.$$end;
  const head = document.head;
  for (let node = start.nextSibling!; node !== end;) {
    const next = node.nextSibling!;
    if (node.nodeType === 1 && Array.from(head.children).some((el) => el.isEqualNode(node))) {
      node.parentNode!.removeChild(node);
    }
    node = next;
  }
  for (let node: Node | null = start; node !== null;) {
    const next: Node | null = node === end ? null : node.nextSibling;
    head.appendChild(node);
    node = next;
  }
  onCleanup(() => {
    for (let node: Node | null = start; node !== null;) {
      const next: Node | null = node === end ? null : node.nextSibling;
      node.parentNode?.removeChild(node);
      node = next;
    }
  });
  return null;
}
