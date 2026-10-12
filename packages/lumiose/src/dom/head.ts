// Client variants of `<Title>`, `<Meta>` and `<Head>` (spec §8 Document): they keep `document.head`
// current across SPA navigations, with the server's rules (the deepest `<Title>` wins; metas with the
// same charset/name/property/http-equiv/itemprop dedupe and the deepest wins; ties go to the latest).
// Tags already in `<head>` (rendered by the server) are adopted instead of duplicated.
//
// Defaults (TASK-256): what a title or keyed meta was before the first `<Title>`/`<Meta>` of its
// key took it over comes back when the last one goes, as when the server renders a page without
// them. A tag adopted outside hydration is that default (the document's, or a server-only
// layout's); one adopted while hydrating is the page's own, and its default is the HTML the server
// put in its `data-l-default` when the page replaced one (../app/server/document.ts).
import type { Renderable } from "../contract/client.ts";
import { getOwner, renderEffect } from "../core/internal.ts";
import { onCleanup } from "../core/owner.ts";
import { setAttr } from "./attributes.ts";
import { hydrator } from "./hydration.ts";
import { place, renderRange } from "./insert.ts";

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

/** The default that server tag `el` replaced (its `data-l-default`), parsed; empty when none. */
function replaced(el: Element | null): DocumentFragment {
  const t = document.createElement("template");
  t.innerHTML = el?.getAttribute("data-l-default") ?? "";
  return t.content;
}

// --- Title ---------------------------------------------------------------------------------------

const titles: Entry<string>[] = [];
let defaultTitle = "";

function updateTitle(): void {
  document.title = winner(titles)?.value ?? defaultTitle;
}

/**
 * Sets `document.title`. The deepest `<Title>` wins (a page overrides its layouts); the default
 * title comes back when the last one goes.
 */
export function Title(props: { children?: Renderable }): Renderable {
  if (titles.length === 0) {
    defaultTitle = hydrator
      ? replaced(document.querySelector("title")).textContent!
      : document.title;
  }
  addEntry(titles, () => textOf(props.children), updateTitle);
  return null;
}

// --- Meta ----------------------------------------------------------------------------------------

type Attributes = Record<string, unknown>;

const META_KEYS = ["charset", "name", "property", "http-equiv", "itemprop"] as const;
const metas = new Map<string, Entry<Attributes>[]>();
const metaElements = new Map<string, Element & { $$d?: Node }>();
let unkeyed = 0;

/** The dedupe key of a meta (read through `get`: props or an element), or `undefined` when it has none. */
function metaKey(get: (name: string) => unknown): string | undefined {
  const name = META_KEYS.find((key) => get(key) != null);
  return name === undefined
    ? undefined
    : name === "charset"
      ? name
      : `${name}:${String(get(name))}`;
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
      (key[0] === "#" ? el.isEqualNode(probe) : metaKey((name) => el.getAttribute(name)) === key)
    ) {
      return el;
    }
  }
  return undefined;
}

function updateMeta(key: string): void {
  const best = winner(metas.get(key)!);
  let el = metaElements.get(key);
  if (best === undefined) {
    // The default (`$$d`, possibly empty) comes back where the tag was.
    el?.replaceWith(el.$$d!);
    metaElements.delete(key);
    metas.delete(key);
    return;
  }
  if (el === undefined) {
    const adopted = adoptMeta(key, best.value!);
    el = adopted ?? document.head.appendChild(document.createElement("meta"));
    el.$$d = hydrator ? replaced(el) : (adopted?.cloneNode() ?? new DocumentFragment());
    metaElements.set(key, el);
  }
  setAttributes(el, best.value!);
}

/**
 * Adds or updates a `<meta>` in `<head>`. On disposal the next deepest comes back, else the tag's
 * default (or none).
 */
export function Meta(props: Attributes): Renderable {
  const key = metaKey((name) => props[name]) ?? `#${unkeyed++}`;
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
 * `<head>` (for example rendered by the server) are skipped. While hydrating, that one is the
 * server's render of this component (`$$h` marks it taken, so that two components with the same
 * element take one each): it stays in place and goes with it.
 */
export function Head(props: { children?: Renderable }): Renderable {
  const start = renderRange(() => props.children);
  const end = start.$$end;
  const head = document.head;
  let taken: Element[] | undefined;
  for (let node = start.nextSibling!; node !== end;) {
    const next = node.nextSibling!;
    const twin =
      node.nodeType === 1 &&
      Array.from(head.children as HTMLCollectionOf<Element & { $$h?: true }>).find(
        (el) => !(hydrator && el.$$h) && el.isEqualNode(node),
      );
    if (twin) {
      (node as ChildNode).remove();
      if (hydrator) {
        (taken ??= []).push(twin);
        twin.$$h = true;
      }
    }
    node = next;
  }
  place(head, start, null);
  // The range leaves `<head>` as a unit (into a fragment of its own).
  onCleanup(() => {
    place(new DocumentFragment(), start, null);
    taken?.forEach((el) => el.remove());
  });
  return null;
}
