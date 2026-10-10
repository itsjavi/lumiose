// Island call sites on the server (decision-9, spec §7.2, §7.4):
//
//   <!--l:ID--><template data-l-slot="icon">…</template>…<!--l:s:children-->…<!--/l:s-->…<!--/l:ID-->
//
// Slots (JSX-valued props and children) are static HTML rendered in the call site's frame. Where
// the island renders a slot during SSR, it appears inline between `<!--l:s:name-->` and
// `<!--/l:s-->`, and the client adopts those nodes; a slot the island did not render travels once,
// as a `<template data-l-slot>` at the start of the range, for the client to insert later.
// The record `{ id, ref, strategy, props, value?, slots?, awaits? }` is flushed with the chunk
// (shell or boundary) the island renders in. `client:only` renders no component, so all its slots
// are templates. An island inside another island's own render is rendered inline, with no record.
//
// The island renders under an isolated owner: the browser hydrates it as its own root, so its
// `useContext()` calls do not see context the page provided outside it here either (TASK-194). The
// owner is still a child of the call site's, so `getAbortSignal()`, cleanups and head depth follow the
// page; Suspense, error boundaries and request APIs use the frame and the request scope instead.

import { LUM_ISLAND_PAGE_CONTEXT, LUM_ISLAND_PROP, LumioseError } from "../app/diagnostics.ts";
import { createOwner, getOwner, runWithOwner } from "../core/internal.ts";
import { isolateOwner } from "../core/owner.ts";
import { DEV } from "../dom/dev.ts";
import type { IslandStrategy } from "../contract/server.ts";
import {
  content,
  createComponent,
  renderFrame,
  resolveUnit,
  runComponent,
  type Frame,
  type IslandRecord,
  type IslandState,
  type ServerComponent,
} from "./frame.ts";
import { escapeAttr, html, join, SSRHtml, wrap, type Html } from "./node.ts";
import { addPreload } from "./render.ts";
import { encodeData } from "./serialize.ts";
import { restProps } from "./ssr.ts";

export function island<P>(
  ref: string,
  component: ServerComponent<P>,
  props: P,
  strategy: IslandStrategy,
  strategyValue?: string,
  slots?: Record<string, () => unknown>,
): unknown {
  const parent = renderFrame("island()");
  const names = slots === undefined ? [] : Object.keys(slots);
  if (parent.island !== undefined) {
    return createComponent(
      component,
      withSlots(props, names, (name) => slots![name]!()),
    );
  }
  const render = parent.render;
  const id = render.nextIsland++;
  const record: IslandRecord = {
    id,
    ref,
    strategy,
    props: encodeProps(ref, strategy, props as object, names),
  };
  if (strategyValue !== undefined) record.value = strategyValue;
  if (names.length > 0) record.slots = names;
  const unit = resolveUnit(parent.unit);
  const state: IslandState = { id, ref, record, unit };
  unit.islands.push(state);
  if (strategy === "load") addPreload(render, unit, render.moduleUrl(specifierOf(ref)));

  // Slots are static server HTML from the call site's frame (not hydrated as part of the island).
  const rendered: Record<string, Html> = {};
  for (const name of names) rendered[name] = content(slots![name]!());
  const inline = new Set<string>();
  let out: Html = "";
  if (strategy !== "only") {
    const frame: Frame = {
      render,
      unit: parent.unit,
      island: state,
      path: "0",
      children: 0,
      occurrences: undefined,
      streamed: parent.streamed,
    };
    const owner = createOwner(getOwner());
    isolateOwner(owner, DEV ? () => warnPageContext(ref) : undefined);
    const node = runWithOwner(owner, () =>
      runComponent(
        component,
        withSlots(props, names, (name) => {
          inline.add(name);
          return html(wrap(`<!--l:s:${name}-->`, rendered[name]!, "<!--/l:s-->"));
        }),
        frame,
      ),
    );
    out = node instanceof SSRHtml ? node.t : node.then((done) => done.t);
  }
  // Known once the island rendered: the slots it read are inline, the others become templates.
  const templates = (): Html =>
    join(
      names
        .filter((name) => !inline.has(name))
        .map((name) =>
          wrap(`<template data-l-slot="${escapeAttr(name)}">`, rendered[name]!, "</template>"),
        ),
    );
  return html(
    join([
      `<!--l:${id}-->`,
      typeof out === "string" ? templates() : out.then(templates),
      out,
      `<!--/l:${id}-->`,
    ]),
  );
}

// Dev: warned islands, once per process.
const warned = new Set<string>();

function warnPageContext(ref: string): void {
  if (warned.has(ref)) return;
  warned.add(ref);
  console.warn(
    `Lumiose: ${LUM_ISLAND_PAGE_CONTEXT}: island ${nameOf(ref)} (${ref}) calls useContext() for a context that the page provides outside the island. Islands hydrate as their own root, so the island gets the context's default value, on the server as in the browser. Pass the value as an island prop, provide it inside the island, or share module-scope state (run \`lumiose docs ${LUM_ISLAND_PAGE_CONTEXT}\`).`,
  );
}

function nameOf(ref: string): string {
  const hash = ref.lastIndexOf("#");
  return hash === -1 ? "Island" : ref.slice(hash + 1);
}

function specifierOf(ref: string): string {
  const hash = ref.lastIndexOf("#");
  return hash === -1 ? ref : ref.slice(0, hash);
}

function encodeProps(ref: string, strategy: string, props: object, slots: string[]): unknown {
  const data: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (!slots.includes(key)) data[key] = (props as Record<string, unknown>)[key];
  }
  return encodeData(data, (path, reason) => {
    const name = nameOf(ref);
    throw new LumioseError(
      LUM_ISLAND_PROP,
      `Island prop "${path.replace(/^\./, "")}" of <${name} client:${strategy}> (${ref}) is ${reason}. Island props are sent to the browser and must be plain data: strings, numbers, booleans, null, arrays, plain objects, Date, Map, Set, BigInt or URL. Pass JSX as children, and keep functions inside the island`,
    );
  });
}

/** `props` with each slot as a getter. */
function withSlots<P>(props: P, names: readonly string[], get: (name: string) => unknown): P {
  if (names.length === 0) return props;
  const out = restProps(props as object, names as never) as P;
  for (const name of names) {
    Object.defineProperty(out, name, {
      enumerable: true,
      configurable: true,
      get: () => get(name),
    });
  }
  return out;
}
