// `lumiose/dom/hydrate` (owner: Spark): the hydration claim cursor and `hydrate()` (contract doc-2
// §1, §3.1, §4; spec §7.2, §7.4). Only the island loader and hydrating entries import it, so
// bundles that never hydrate contain none of this.
//
// Positional claiming. Inside an island the server marks every range the client claims
// (doc-2 §3.1): `<!--[-->…<!--]-->` blocks for regions, async instances and boundaries
// (`<!--[!-->` for an inactive branch or a server-rendered error fallback), `<!--!-->` between
// adjacent texts, and `<!--l:s:NAME-->…<!--/l:s-->` around slots. The cursor keeps a stack of
// holes: runs of server nodes that a region adopts, with nested blocks and slots collapsed to
// their opening comment.
// - `template()` claims the next node of the hole on top and walks the template content and the
//   server nodes side by side, reshaping the server DOM into the client's: separators go, each
//   block becomes a hole keyed by the client's parent and marker (a `<!>` placeholder keeps the
//   block's closing comment as its marker; otherwise both comments go), and a text node is
//   created where an empty dynamic text rendered none. The holes are pushed in reverse document
//   order, so a value created before its region opens (`insert(el, createComponent(C), m)`)
//   claims from the next hole.
// - `region()` (insert, branch, list) finds its hole by key and makes it the top until `end()`.
//   Regions the server did not mark mismatch; regions in detached nodes render afresh.
// - Ranges claim explicitly (`createRange(mode)`): the next block (branchValue, listValue,
//   Suspense, ErrorBoundary, where `<!--[!-->` renders afresh), or the rest of the region for
//   boundary content. Their markers replace the block's comments, so nothing moves.
// - Async instances fork a cursor for their first run (carried by its frame), which claims the
//   instance's block after each replayed await.
// A mismatch disposes the island, clears its range and renders it on the client (LUM4006 in dev),
// still replaying recorded awaits.
import type { Component, Renderable } from "../contract/client.ts";
import { createOwner, disposeOwner, onError, runWithOwner, type Owner } from "../core/internal.ts";
import { decodeData } from "../server/serialize.ts";
import { createComponent } from "./component.ts";
import { DEV } from "./dev.ts";
import { setFrameHook, withIsland, type AwaitReplay } from "./frame.ts";
import { hydrator, MISMATCH, setHydrator, type Hydrator } from "./hydration.ts";
import { insert, type RangeStart } from "./insert.ts";

export type { Hydrator } from "./hydration.ts";

/** Server nodes a region adopts, in order; blocks and slots collapsed to their opening comment. */
interface Hole extends Array<Node> {
  /** The next entry to claim. */
  i: number;
  /** The client region's parent and marker: the key `region()` finds the hole by. */
  p: Node;
  m: Node | null;
  /** Content renders afresh instead of claiming. */
  f: boolean;
  /** The server block was `<!--[!-->`: a branch showed its `whenFalse` side. */
  n: boolean;
  /** The walk link that skips the block's content until the region opens (see `skip`). */
  d?: Link;
}

/**
 * A `firstChild`/`nextSibling` own property set on a server node so that the compiled template
 * walk steps over block content left in place (see `walk`).
 */
type Link = [node: Node, key: "firstChild" | "nextSibling"];

/** Makes `link` lead to `to` for the compiled walk, without moving any node. */
function skip(link: Link, to: Node): void {
  Object.defineProperty(link[0], link[1], { configurable: true, value: to });
}

/** Restores the DOM's own `firstChild`/`nextSibling` of a link that `skip` redirected. */
function unskip(link: Link): void {
  delete (link[0] as unknown as Record<string, unknown>)[link[1]];
}

/** Per island: whether claiming failed, and the client-render fallback. */
interface Island {
  f: boolean;
  /** Walk links redirected by `skip` whose regions have not opened yet. */
  l: Link[];
  /** The fallback ran. */
  d: boolean;
  r: () => void;
}

// Each frame carries the cursor of its run (or none): install it along with the frame.
setFrameHook((next) => setHydrator(next?.h));

function hole(nodes: Node[], p: Node, m: Node | null, f = false, n = false): Hole {
  const h = nodes as Hole;
  h.i = 0;
  h.p = p;
  h.m = m;
  h.f = f;
  h.n = n;
  return h;
}

/** The comment closing the block (`[`, `[!`) or slot (`l:s:NAME`) that `open` starts. */
function closeOf(open: Comment): Comment {
  const isSlot = open.data[0] === "l";
  let depth = 0;
  for (let node = open.nextSibling!; ; node = node.nextSibling!) {
    if (node.nodeType === 8) {
      const data = (node as Comment).data;
      if (isSlot ? data.startsWith("l:s:") : data[0] === "[") {
        depth++;
      } else if ((isSlot ? data === "/l:s" : data === "]") && depth-- === 0) {
        return node as Comment;
      }
    }
  }
}

/** The nodes from `node` up to `stop`, with blocks and slots collapsed to their opening comment. */
function entries(node: Node | null, stop: Node | null): Node[] {
  const out: Node[] = [];
  for (; node !== stop; node = node!.nextSibling) {
    out.push(node!);
    if (node!.nodeType === 8 && /^(\[|l:s:)/.test((node as Comment).data)) {
      node = closeOf(node as Comment);
    }
  }
  return out;
}

function top(stack: Hole[]): Hole {
  return stack[stack.length - 1]!;
}

function fail(x: Island): never {
  if (!x.f) {
    x.f = true;
    // Claims after an await fail outside `hydrate()`, which handles the synchronous pass.
    queueMicrotask(x.r);
  }
  throw MISMATCH;
}

/** Claims the next entry of `h` for template node `t`. */
function claim(x: Island, h: Hole, t: Node, holes: Hole[]): Node {
  const s = h[h.i];
  if (s === undefined || s.nodeName !== t.nodeName) {
    fail(x);
  }
  h.i++;
  walk(x, t, s, holes, x.l);
  return s;
}

/**
 * Aligns the children of server node `s` with those of template node `t`; collects holes. Block
 * content stays in place (moving server nodes makes the browser paint them again, and report a
 * new Largest Contentful Paint): the link the compiled `firstChild`/`nextSibling` walk takes into
 * a run of blocks is redirected to the server node aligned with the next template node, until the
 * blocks' regions open.
 */
function walk(x: Island, t: Node, s: Node, holes: Hole[], links: Link[]): void {
  let tc = t.firstChild;
  let sc = s.firstChild;
  // A block that precedes a static template node, which becomes its marker.
  let before: Hole | undefined;
  // The walk's way to the next aligned node: `firstChild` of `s`, then the last aligned node's
  // `nextSibling`; `blocked` once block content lies on it.
  let link: Link = [s, "firstChild"];
  let blocked: Hole[] = [];
  const align = (node: Node): void => {
    if (blocked.length > 0) {
      skip(link, node);
      links.push(link);
      for (const h of blocked) h.d = link;
      blocked = [];
    }
    link = [node, "nextSibling"];
  };
  for (;;) {
    if (sc !== null && sc.nodeType === 8) {
      const data = (sc as Comment).data;
      const next = sc.nextSibling;
      if (data === "!") {
        (sc as ChildNode).remove();
        sc = next;
        continue;
      }
      if (data[0] === "[") {
        const close = closeOf(sc as Comment);
        const h = hole(entries(next, close), s, close, false, data === "[!");
        holes.push(h);
        (sc as ChildNode).remove();
        sc = close.nextSibling;
        if (tc !== null && next !== close) {
          // Content before a template node would derail the compiled walk: it steps over it.
          blocked.push(h);
        }
        if (tc !== null && tc.nodeType === 8) {
          // A `<!>` placeholder: the closing comment is the marker.
          align(close);
          tc = tc.nextSibling;
        } else {
          close.remove();
          h.m = null;
          before = h;
        }
        continue;
      }
    }
    if (tc === null) {
      break;
    }
    if (tc.nodeType === 3 && (sc === null || sc.nodeType !== 3)) {
      // An empty dynamic text renders no server node.
      sc = s.insertBefore(new Text(), sc);
    }
    if (sc === null || sc.nodeName !== tc.nodeName) {
      fail(x);
    }
    if (before !== undefined) {
      before.m = sc;
      before = undefined;
    }
    align(sc);
    walk(x, tc, sc, holes, links);
    tc = tc.nextSibling;
    sc = sc.nextSibling;
  }
  // Content set through a property (`textContent`, `innerHTML`) has no template counterpart.
  if (sc !== null && t.firstChild !== null) {
    fail(x);
  }
}

/** Claims the block at the cursor of `h` for the range `start`; returns its content. */
function block(x: Island, h: Hole, start: Node, fresh: boolean): Hole {
  const open = h[h.i] as Comment | undefined;
  if (open === undefined || open.nodeType !== 8 || open.data[0] !== "[") {
    fail(x);
  }
  const close = closeOf(open);
  const end = (start as RangeStart).$$end;
  const parent = open.parentNode!;
  const failed = open.data === "[!";
  const content = hole(entries(open.nextSibling, close), parent, end, fresh && failed, failed);
  open.replaceWith(start);
  close.replaceWith(end);
  h[h.i++] = start;
  return content;
}

/** The claim cursor of one run: a stack of holes, the top one being claimed. */
class Cursor implements Hydrator {
  s: Hole[];
  x: Island;

  constructor(s: Hole[], x: Island) {
    this.s = s;
    this.x = x;
  }

  template(content: Node, flags: number): Node | Node[] | undefined {
    const h = top(this.s);
    if (h.f) {
      return undefined;
    }
    const holes: Hole[] = [];
    let out: Node | Node[];
    if (flags & 1) {
      // MultiRoot: `content` holds the roots, claimed one after the other.
      out = [];
      for (let t = content.firstChild; t !== null; t = t.nextSibling) {
        out.push(claim(this.x, h, t, holes));
      }
    } else {
      out = claim(this.x, h, content, holes);
    }
    for (let k = holes.length; k--;) {
      this.s.push(holes[k]!);
    }
    return out;
  }

  region(parent: Node, marker: Node | null): Node[] {
    const s = this.s;
    for (let k = s.length; k--;) {
      const h = s[k]!;
      if (h.m === marker && (marker !== null || h.p === parent)) {
        s.length = k + 1;
        // The compiled walk is past this block: the DOM's own links apply again.
        if (h.d) unskip(h.d);
        return h;
      }
    }
    if (!top(s).f && parent.isConnected) {
      // The server marked no region here.
      fail(this.x);
    }
    // Detached nodes (fresh content, list rows that render several nodes, portals) render afresh.
    const h = hole([], parent, marker, true);
    s.push(h);
    return h;
  }

  block(marker: Node): boolean {
    return this.s.some((h) => h.m === marker);
  }

  branch(nodes: Node[], on: boolean): void {
    if ((nodes as Hole).n === on) {
      fail(this.x);
    }
  }

  end(nodes: Node[]): void {
    const k = this.s.lastIndexOf(nodes as Hole);
    if (k >= 0) {
      this.s.length = k;
    }
  }

  range(start: Node, mode: number): void {
    const h = top(this.s);
    if (h.f) {
      return;
    }
    let content: Hole;
    if (mode === 3) {
      // The rest of the enclosing region, wrapped in place by the range's markers.
      const end = (start as RangeStart).$$end;
      const rest = h.splice(h.i++, h.length, start);
      const parent = h.m?.parentNode ?? h.p;
      parent.insertBefore(start, rest[0] ?? h.m);
      parent.insertBefore(end, h.m);
      content = hole(rest, parent, end);
    } else {
      content = block(this.x, h, start, mode === 2);
    }
    this.s.push(content);
  }

  fork(start: Node): [Node[], Hydrator] {
    const h = top(this.s);
    const content = h.f ? hole([], h.p, null, true) : block(this.x, h, start, false);
    return [content, new Cursor([content], this.x)];
  }
}

/** Pending forever: what `fetch` returns while an await expression is evaluated for tracking. */
const never = (): Promise<never> => new Promise(() => {});

/**
 * Evaluates a replayed await expression for its reactive reads only (`props.id` in
 * `fetchJSON(\`/api/${props.id}\`)`), so the run re-runs when they change, as after a real await.
 * `fetch` is held off meanwhile and the result is dropped: the recorded value is used instead.
 */
function track(thunk: () => unknown): void {
  const fetch = globalThis.fetch;
  globalThis.fetch = never;
  try {
    (thunk() as Promise<unknown> | undefined)?.then?.(undefined, never);
  } catch {
    // The value is replayed; errors evaluating the expression again do not matter.
  } finally {
    globalThis.fetch = fetch;
  }
}

/** Where a slot's server HTML comes from: its `<template data-l-slot>`, or inline nodes. */
interface SlotSource {
  /** The template content, or the copy made from `n` on first use. */
  c?: Node;
  /** The inline server nodes of the slot's first occurrence, copied lazily. */
  n?: Node[];
}

/**
 * A slot's content: under hydration, the inline server nodes at the cursor, adopted in place (the
 * region's hole takes them instead of the slot's opening comment, so reconciling moves nothing);
 * otherwise a copy of its server HTML (the first inline occurrence, or its template).
 */
function slot(name: string, sources: Record<string, SlotSource>): Renderable {
  const cursor = hydrator as Cursor | undefined;
  const x = cursor && top(cursor.s);
  const open = x !== undefined && !x.f ? x[x.i] : undefined;
  if (open !== undefined && open.nodeType === 8 && (open as Comment).data === `l:s:${name}`) {
    const close = closeOf(open as Comment);
    const nodes: Node[] = [];
    for (let node = open.nextSibling!; node !== close; node = node.nextSibling!) {
      nodes.push(node);
    }
    x!.splice(x!.i, 1, ...nodes);
    x!.i += nodes.length;
    (open as Comment).remove();
    close.remove();
    return nodes;
  }
  const source = sources[name];
  if (!source) return undefined;
  if (!source.c) {
    // First copy of an inline slot: made now, not for every hydration.
    const copy = (source.c = new DocumentFragment());
    for (const node of source.n!) copy.appendChild(node.cloneNode(true));
  }
  return source.c.cloneNode(true) as Renderable;
}

/**
 * Hydrates the island between the comments `start` and `end` (`<!--l:ID-->`, `<!--/l:ID-->`):
 * renders `component` with `props`, claiming the server nodes instead of creating them, and
 * replays `awaits` (`{ "instancePath:site:occurrence": encoded value }`) instead of evaluating
 * first-run awaits. Each name in `slots` becomes a prop holding its server HTML. With `fresh`
 * (`client:only`), the island renders on the client without claiming. Returns a disposer.
 */
export function hydrate<P extends object>(
  component: Component<P>,
  props: P,
  start: Node,
  end: Node,
  awaits?: Record<string, unknown>,
  slots?: readonly string[],
  fresh?: boolean,
): () => void {
  const parent = start.parentNode!;
  // Dev diagnostics only: production builds drop the read.
  const name = DEV ? component.name || "(anonymous)" : "";
  // Slot sources: `<template data-l-slot>` (slots the server did not render) right after `start`,
  // and the nodes of each slot rendered inline (copied only if a slot renders a copy).
  // Dev: a hot swap renders the island again (fresh), with the slot sources of its first render.
  const kept = start as Node & { $$slots?: Record<string, SlotSource> };
  const sources: Record<string, SlotSource> = (DEV && kept.$$slots) || {};
  if (DEV) kept.$$slots = sources;
  for (
    let el = start.nextSibling as Element;
    el.nodeName === "TEMPLATE" && el.hasAttribute("data-l-slot");
    el = start.nextSibling as Element
  ) {
    sources[el.getAttribute("data-l-slot")!] = { c: (el as HTMLTemplateElement).content };
    el.remove();
  }
  const walker = document.createTreeWalker(parent, 128);
  walker.currentNode = start;
  for (let c: Comment | null; (c = walker.nextNode() as Comment | null) !== end && c !== null;) {
    if (c.data.startsWith("l:s:")) {
      const close = closeOf(c);
      const source = (sources[c.data.slice(4)] ??= {});
      if (!source.c && !source.n) {
        source.n = [];
        for (let node = c.nextSibling!; node !== close; node = node.nextSibling!) {
          source.n.push(node);
        }
      }
      walker.currentNode = close;
    }
  }
  for (const key of slots ?? []) {
    Object.defineProperty(props, key, {
      configurable: true,
      enumerable: true,
      get: () => slot(key, sources),
    });
  }

  const replay: AwaitReplay = (key, thunk) => {
    if (awaits !== undefined && Object.hasOwn(awaits, key)) {
      track(thunk);
      return { value: decodeData(awaits[key]) };
    }
    if (DEV && !fresh) {
      console.warn(
        `Lumiose: LUM4006: island ${name} has no recorded await ${key}, so the client awaits it again. Keep awaits in the same order on the server and the client (run \`lumiose docs LUM4006\`).`,
      );
    }
    return undefined;
  };

  let owner: Owner;
  const render = (h: Hydrator | undefined): void => {
    owner = createOwner(undefined);
    runWithOwner(owner, () => {
      // Mismatches after an await reject their run; the fallback below replaces the island.
      onError((error) => {
        if (error !== MISMATCH) {
          throw error;
        }
      });
      withIsland(replay, h, () => insert(parent, createComponent(component, props), end));
    });
  };
  const island: Island = {
    f: false,
    l: [],
    d: false,
    r: () => {
      if (island.d) {
        return;
      }
      island.d = true;
      disposeOwner(owner);
      while (start.nextSibling !== end) {
        (start.nextSibling as ChildNode).remove();
      }
      if (DEV) {
        console.warn(
          `Lumiose: LUM4006: hydration mismatch in island ${name}: the server HTML does not match the client render, so the island was rendered on the client instead. Render the same output on both sides for the same props (run \`lumiose docs LUM4006\`).`,
        );
      }
      render(undefined);
    },
  };
  if (fresh) {
    render(undefined);
  } else {
    // Claiming moves no server node (see `walk`, `slot`), so focus and selection stay put.
    try {
      render(new Cursor([hole(entries(start.nextSibling, end), parent, end)], island));
    } catch (error) {
      if (error !== MISMATCH) {
        throw error;
      }
    }
    // Normally each link is restored when its region opens; never leave one redirected.
    for (const link of island.l) unskip(link);
    island.l = [];
    if (island.f) {
      island.r();
    }
  }
  return () => disposeOwner(owner);
}
