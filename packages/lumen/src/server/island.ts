// Island call sites on the server (decision-9, spec §7.2, §7.4):
//
//   <!--l:ID--><template data-l-slot="children">…</template>…island HTML…<!--/l:ID-->
//
// The record `{ id, ref, strategy, props, value?, slots?, awaits? }` is flushed with the chunk
// (shell or boundary) the island renders in. `client:only` renders the slots but not the component.
// An island inside another island's own render is rendered inline, with no record.

import { LUM_ISLAND_PROP, LumenError } from "../app/diagnostics.ts";
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
  const pieces: Html[] = [`<!--l:${id}-->`];
  for (const name of names) {
    rendered[name] = content(slots![name]!());
    pieces.push(
      wrap(`<template data-l-slot="${escapeAttr(name)}">`, rendered[name], "</template>"),
    );
  }
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
    const out = runComponent(
      component,
      withSlots(props, names, (name) => html(rendered[name]!)),
      frame,
    );
    pieces.push(out instanceof SSRHtml ? out.t : out.then((node) => node.t));
  }
  pieces.push(`<!--/l:${id}-->`);
  return html(join(pieces));
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
    const hash = ref.lastIndexOf("#");
    const name = hash === -1 ? "Island" : ref.slice(hash + 1);
    throw new LumenError(
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
