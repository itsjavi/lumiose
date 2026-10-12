// `lumiose dev` in the browser (TASK-148): after an edit to server-only code, the page is patched
// in place with the server's fresh HTML for its URL instead of reloading, much like React Router's
// hot data revalidation. Islands keep their DOM and state; focus, scroll positions and form input
// survive. Runs in the browser (./client.ts), so it imports nothing.
//
// - When: the page and its fresh copy have the same status, shell and islands (their dev
//   annotations, ./annotation.ts), the page was a GET and its fresh copy rendered without errors.
//   Anything else reloads: new or removed scripts would not run, html/head/body attributes are the
//   document's, and a changed island would keep stale props or slots.
// - How: children are matched in order, by key where there is one (an `id`, a form control's
//   `name`, a head element's identity: a meta's name, a link's `href` or Vite module id, a
//   script's or style's content), else by tag (and class, so an inserted sibling does not take
//   over its neighbour's subtree). Matched elements get the new attributes and are patched
//   recursively; the rest is inserted or removed.
// - Islands: `<!--l:ID-->…<!--/l:ID-->` ranges are opaque. The old range (comments included, as the
//   island loader holds them) takes the new range's place, wherever it moved.
// - Kept: elements the server did not send (a portal's container, Vite's `<style>` of imported
//   CSS, anything client code added after the page loaded), the values of edited form controls,
//   scripts, and the stylesheet links Vite swaps on CSS updates.
// - Head: new stylesheets load before the body is patched, and removed ones go after, so the page
//   does not flash unstyled.

import type { DevAnnotation } from "./annotation.ts";

/** Elements the server sent (tracked from the page load on), as opposed to client-added ones. */
export type ServerElements = WeakSet<Node>;

/** The page cannot be patched in place: reload it. */
export class MorphError extends Error {}

/** How long the body waits for new stylesheets to load. */
const STYLESHEET_TIMEOUT = 3000;
const ISLAND_START = /^l:(\d+)$/;

/** Tracks the elements of a freshly loaded page as the server's. */
export function serverElements(doc: Document): ServerElements {
  const elements: ServerElements = new WeakSet();
  const walker = doc.createTreeWalker(doc, 1);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) elements.add(node);
  return elements;
}

/**
 * Patches `doc` with `response`, the fresh copy of its page. Resolves `false` when the page must
 * reload instead; rejects (`MorphError`) when patching failed halfway, which reloads too.
 */
export async function patchPage(
  doc: Document,
  response: Response,
  server: ServerElements,
  options: { stylesheetTimeout?: number } = {},
): Promise<boolean> {
  if (doc.querySelector("vite-error-overlay") !== null) return false;
  const current = annotation(doc);
  if (current === undefined || current.method !== "GET") return false;
  if (response.redirected || response.status !== current.status) return false;
  if (!/^text\/html\b/i.test(response.headers.get("content-type") ?? "")) return false;
  const next = new DOMParser().parseFromString(await response.text(), "text/html");
  const fresh = annotation(next);
  if (
    fresh === undefined ||
    fresh.errors ||
    fresh.shell !== current.shell ||
    fresh.islands !== current.islands
  ) {
    return false;
  }
  resolveSwaps(next);
  await morphDocument(doc, next, server, options.stylesheetTimeout ?? STYLESHEET_TIMEOUT);
  return true;
}

/** The page's dev annotation (the last one: client code may have appended nothing after it). */
export function annotation(doc: Document): DevAnnotation | undefined {
  const scripts = doc.querySelectorAll("script[data-l-dev]");
  const script = scripts[scripts.length - 1];
  try {
    return script === undefined ? undefined : (JSON.parse(script.textContent!) as DevAnnotation);
  } catch {
    return undefined;
  }
}

/**
 * Moves each streamed boundary's `<template for>` content into its `<?start>…<?end>` placeholder,
 * as the page's `$swap` script did (DOMParser runs no scripts).
 */
export function resolveSwaps(doc: Document): void {
  for (const template of doc.querySelectorAll<HTMLTemplateElement>("template[for]")) {
    const marker = `?start name="${template.getAttribute("for")}"`;
    const walker = doc.createTreeWalker(doc, 128);
    let start = walker.nextNode() as Comment | null;
    while (start !== null && start.data !== marker) start = walker.nextNode() as Comment | null;
    if (start === null) continue;
    let end: ChildNode | null = start;
    for (let depth = 0; (end = end.nextSibling) !== null;) {
      if (end.nodeType !== 8) continue;
      const data = (end as Comment).data;
      if (data.startsWith("?start")) depth++;
      else if (data === "?end" && depth-- === 0) break;
    }
    while (start.nextSibling !== end) start.nextSibling!.remove();
    start.parentNode!.insertBefore(template.content, end);
    start.remove();
    end?.remove();
    template.remove();
  }
}

interface Context {
  doc: Document;
  server: ServerElements;
  /** The start comment of each island of the page, by id. */
  islands: Map<string, Comment>;
  /** The top-level nodes of the page's island ranges: never matched, patched or removed. */
  reserved: Set<Node>;
  /** The Vite module ids of the fresh head's stylesheet links. */
  devIds: Set<string>;
  /** The page's CSP nonce, for inserted elements. */
  nonce: string;
  /** Head phase: inserted stylesheets (awaited), and removed ones (removed after the body). */
  inserted?: HTMLLinkElement[];
  removed?: Node[];
}

/** Patches `doc` (head, then body) into `next`, keeping islands, focus, scroll and form input. */
export async function morphDocument(
  doc: Document,
  next: Document,
  server: ServerElements,
  stylesheetTimeout = STYLESHEET_TIMEOUT,
): Promise<void> {
  const ctx: Context = {
    doc,
    server,
    islands: new Map(),
    reserved: new Set(),
    devIds: new Set(),
    nonce: (doc.querySelector("[nonce]") as HTMLElement | null)?.nonce ?? "",
    inserted: [],
    removed: [],
  };
  const walker = doc.createTreeWalker(doc, 128);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const id = ISLAND_START.exec((node as Comment).data)?.[1];
    if (id === undefined) continue;
    ctx.islands.set(id, node as Comment);
    for (const member of range(node as Comment) ?? []) ctx.reserved.add(member);
  }
  for (const link of next.head.querySelectorAll("link[data-vite-dev-id]")) {
    ctx.devIds.add(link.getAttribute("data-vite-dev-id")!);
  }
  const view = doc.defaultView;
  const scroll = view === null ? undefined : [view.scrollX, view.scrollY];
  const focus = saveFocus(doc);

  morphChildren(doc.head, next.head, ctx);
  const { inserted = [], removed = [] } = ctx;
  ctx.inserted = ctx.removed = undefined;
  await loaded(inserted, stylesheetTimeout);
  morphChildren(doc.body, next.body, ctx);
  for (const node of removed) (node as ChildNode).remove();

  focus();
  if (
    view !== null &&
    scroll !== undefined &&
    (view.scrollX !== scroll[0] || view.scrollY !== scroll[1])
  ) {
    view.scrollTo(scroll[0]!, scroll[1]!);
  }
}

/** Patches the children of `from` into those of `to`. */
function morphChildren(from: ParentNode, to: ParentNode, ctx: Context): void {
  const kept = new Set<Node>();
  let cursor = from.firstChild;
  for (let next = to.firstChild; next !== null;) {
    // Every node before the cursor is kept (or foreign), so the cursor can be found again when
    // its node moved away (an island range taken into a new parent).
    cursor = skip(
      cursor !== null && cursor.parentNode !== from ? from.firstChild : cursor,
      kept,
      ctx,
    );
    const island = islandOf(next);
    if (island !== undefined) {
      const end = range(next as Comment)?.at(-1);
      const members = range(ctx.islands.get(island));
      if (end === undefined || members === undefined) {
        throw new MorphError(`The range of island ${island} is incomplete.`);
      }
      for (const member of members) {
        kept.add(member);
        if (member === cursor) cursor = cursor.nextSibling;
        else from.insertBefore(member, cursor);
      }
      next = end.nextSibling;
      continue;
    }
    const following = next.nextSibling;
    const match = findMatch(next, cursor, kept, ctx);
    if (match === null) {
      const node = importTree(next, ctx);
      kept.add(node);
      if (cursor !== null && cursor.parentNode !== from) cursor = skip(from.firstChild, kept, ctx);
      from.insertBefore(node, cursor);
      if (ctx.inserted !== undefined && isStylesheet(node)) ctx.inserted.push(node);
    } else {
      kept.add(match);
      if (match === cursor) cursor = cursor.nextSibling;
      else from.insertBefore(match, cursor);
      morphNode(match, next, ctx);
    }
    next = following;
  }
  for (let node = from.firstChild; node !== null;) {
    const following = node.nextSibling;
    if (
      !kept.has(node) &&
      !ctx.reserved.has(node) &&
      !isForeign(node, ctx) &&
      !isLiveDevLink(node, ctx)
    ) {
      if (ctx.removed !== undefined && isStylesheet(node)) ctx.removed.push(node);
      else node.remove();
    }
    node = following;
  }
}

/** The first node from `node` on that is still to be matched. */
function skip(node: ChildNode | null, kept: Set<Node>, ctx: Context): ChildNode | null {
  while (node !== null && (kept.has(node) || isForeign(node, ctx))) node = node.nextSibling;
  return node;
}

/**
 * The old node `next` patches, from `cursor` on: the first one with its key; else the first
 * similar one (same tag and class); else the node at the cursor, if it has the same tag and no
 * later sibling of `next` is similar to it.
 */
function findMatch(
  next: ChildNode,
  cursor: ChildNode | null,
  kept: Set<Node>,
  ctx: Context,
): ChildNode | null {
  const key = keyOf(next);
  // The first candidate, if it has the same tag.
  let first: ChildNode | null | undefined;
  for (let node = cursor; node !== null; node = node.nextSibling) {
    if (kept.has(node) || ctx.reserved.has(node) || isForeign(node, ctx)) continue;
    if (key !== undefined) {
      if (keyOf(node) === key) return node;
      continue;
    }
    const kind = sameKind(node, next);
    if (kind && sameClass(node, next)) return node;
    if (first === undefined) first = kind ? node : null;
  }
  if (first === undefined || first === null) return null;
  for (let later = next.nextSibling; later !== null; later = later.nextSibling) {
    if (keyOf(later) === undefined && sameKind(first, later) && sameClass(first, later)) {
      return null;
    }
  }
  return first;
}

function morphNode(old: ChildNode, next: ChildNode, ctx: Context): void {
  if (old.nodeType !== 1) {
    if (old.nodeValue !== next.nodeValue) old.nodeValue = next.nodeValue;
    return;
  }
  const el = old as Element;
  // Scripts are matched by their content, and never run again; Vite swaps its stylesheet links.
  if (el.localName === "script" || isDevLink(el)) return;
  const restore = saveInput(el);
  morphAttributes(el, next as Element);
  if (el.localName === "template") {
    morphChildren((el as HTMLTemplateElement).content, (next as HTMLTemplateElement).content, ctx);
  } else if (el.localName !== "noscript") {
    morphChildren(el, next as Element, ctx);
  }
  restore();
}

function morphAttributes(el: Element, next: Element): void {
  // A copy: the live map changes as attributes go.
  for (const attr of Array.from(el.attributes)) {
    if (attr.name !== "nonce" && !next.hasAttributeNS(attr.namespaceURI, attr.localName)) {
      el.removeAttributeNS(attr.namespaceURI, attr.localName);
    }
  }
  for (const attr of next.attributes) {
    if (
      attr.name !== "nonce" &&
      el.getAttributeNS(attr.namespaceURI, attr.localName) !== attr.value
    ) {
      el.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
    }
  }
}

/** Imports `node` from the fresh document, with the page's live island ranges in place of its own. */
function importTree(node: ChildNode, ctx: Context): ChildNode {
  const copy = ctx.doc.importNode(node, true);
  const walker = ctx.doc.createTreeWalker(copy, 129);
  const starts: Comment[] = [];
  for (let n: Node | null = walker.currentNode; n !== null; n = walker.nextNode()) {
    if (n.nodeType === 1) {
      ctx.server.add(n);
      if ((n as Element).hasAttribute("nonce")) (n as HTMLElement).nonce = ctx.nonce;
    } else if (islandOf(n) !== undefined) {
      starts.push(n as Comment);
    }
  }
  for (const start of starts) {
    // Inside an island range replaced already (an island in another's slot).
    if (!copy.contains(start)) continue;
    const id = islandOf(start)!;
    const own = range(start);
    const live = range(ctx.islands.get(id));
    if (own === undefined || live === undefined) {
      throw new MorphError(`The range of island ${id} is incomplete.`);
    }
    for (const member of live) start.parentNode!.insertBefore(member, start);
    for (const member of own) member.remove();
  }
  return copy;
}

/** The nodes of the island range that `start` opens, both comments included. */
function range(start: Comment | undefined): ChildNode[] | undefined {
  if (start === undefined) return undefined;
  const close = `/${start.data}`;
  const members: ChildNode[] = [start];
  for (let node = start.nextSibling; node !== null; node = node.nextSibling) {
    members.push(node);
    if (node.nodeType === 8 && (node as Comment).data === close) return members;
  }
  return undefined;
}

function islandOf(node: Node): string | undefined {
  return node.nodeType === 8 ? ISLAND_START.exec((node as Comment).data)?.[1] : undefined;
}

/**
 * Identity of nodes that only match their own kind: an `id`, a form control's `name`, a head
 * element's identity, a script's or style's content (a changed one is replaced).
 */
function keyOf(node: Node): string | undefined {
  if (node.nodeType !== 1) return undefined;
  const el = node as Element;
  const id = el.getAttribute("id");
  if (id !== null && id !== "") return `#${id}`;
  switch (el.localName) {
    case "script":
    case "style":
      return `${el.localName}:${el.getAttribute("type") ?? ""}:${el.getAttribute("src") ?? el.textContent}`;
    case "link":
      return isDevLink(el)
        ? `link:${el.getAttribute("data-vite-dev-id")}`
        : `link:${el.getAttribute("rel")}:${el.getAttribute("href")}`;
    case "meta":
      for (const name of ["charset", "name", "property", "http-equiv", "itemprop"]) {
        const value = el.getAttribute(name);
        if (value !== null) return `meta:${name}=${value}`;
      }
      return undefined;
    case "title":
    case "base":
      return el.parentNode?.nodeName === "HEAD" ? el.localName : undefined;
    case "input":
    case "select":
    case "textarea": {
      const name = el.getAttribute("name");
      return name === null || name === "" ? undefined : `${el.localName}[${name}]`;
    }
    default:
      return undefined;
  }
}

function sameKind(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return a.nodeType === 3 || (a.nodeType === 8 && islandOf(b) === undefined);
  return (
    a.nodeName === b.nodeName &&
    (a as Element).namespaceURI === (b as Element).namespaceURI &&
    keyOf(a) === undefined
  );
}

function sameClass(a: Node, b: Node): boolean {
  return (
    a.nodeType !== 1 ||
    (a as Element).getAttribute("class") === (b as Element).getAttribute("class")
  );
}

/** An element client code added: kept where it is, never matched. */
function isForeign(node: Node, ctx: Context): boolean {
  if (node.nodeType !== 1 || isDevLink(node as Element)) return false;
  // Vite's `<style>` of CSS imported by client modules; a `<Portal>`'s container.
  if (
    (node as Element).localName === "style" &&
    (node as Element).hasAttribute("data-vite-dev-id")
  ) {
    return true;
  }
  return "$$host" in node || !ctx.server.has(node);
}

/** A dev stylesheet link (`data-vite-dev-id`), which Vite replaces with a copy on CSS updates. */
function isDevLink(el: Element): boolean {
  return el.localName === "link" && el.hasAttribute("data-vite-dev-id");
}

/** A stylesheet link of a module the fresh page still links (while Vite swaps it, there are two). */
function isLiveDevLink(node: Node, ctx: Context): boolean {
  return (
    node.nodeType === 1 &&
    isDevLink(node as Element) &&
    ctx.devIds.has((node as Element).getAttribute("data-vite-dev-id")!)
  );
}

function isStylesheet(node: Node): node is HTMLLinkElement {
  return (
    node.nodeType === 1 &&
    (node as Element).localName === "link" &&
    /(?:^|\s)stylesheet(?:\s|$)/i.test((node as Element).getAttribute("rel") ?? "")
  );
}

function loaded(links: readonly HTMLLinkElement[], timeout: number): Promise<void> {
  if (links.length === 0) return Promise.resolve();
  return new Promise((done) => {
    let pending = links.length;
    const timer = setTimeout(done, timeout);
    const settle = (): void => {
      if (--pending === 0) {
        clearTimeout(timer);
        done();
      }
    };
    for (const link of links) {
      link.addEventListener("load", settle, { once: true });
      link.addEventListener("error", settle, { once: true });
    }
  });
}

/**
 * Keeps what the user typed, checked or selected in a form control the patch updates (a changed
 * `value` attribute sets the default; it moves the current value only while it is the default).
 */
function saveInput(el: Element): () => void {
  if (el.localName === "input" || el.localName === "textarea") {
    const input = el as HTMLInputElement;
    const value = input.value !== input.defaultValue ? input.value : undefined;
    const checked = input.checked !== input.defaultChecked ? input.checked : undefined;
    return () => {
      if (value !== undefined) input.value = value;
      if (checked !== undefined) input.checked = checked;
    };
  }
  if (el.localName === "select") {
    const select = el as HTMLSelectElement;
    const value = select.value;
    const chosen =
      [...select.options].find((option) => option.defaultSelected) ?? select.options[0];
    if (chosen === undefined || chosen.value === value) return () => {};
    return () => {
      if ([...select.options].some((option) => option.value === value)) select.value = value;
    };
  }
  return () => {};
}

/** Saves the focused element and its selection; the returned function restores them. */
function saveFocus(doc: Document): () => void {
  const active = doc.activeElement as HTMLInputElement | null;
  if (active === null || active === doc.body) return () => {};
  let selection: [number, number, "forward" | "backward" | "none"] | undefined;
  try {
    if (active.selectionStart !== null && active.selectionStart !== undefined) {
      selection = [
        active.selectionStart,
        active.selectionEnd!,
        active.selectionDirection ?? "none",
      ];
    }
  } catch {
    // Inputs without a selection (checkbox, number) throw in some browsers.
  }
  return () => {
    if (doc.activeElement === active || !active.isConnected) return;
    active.focus({ preventScroll: true });
    if (selection !== undefined) active.setSelectionRange(...selection);
  };
}
