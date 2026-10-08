// Events (decision-17, contract doc-2 §2, spec §6.2-6.3).
//
// `onX` handlers of bubbling events are delegated: the compiler stores the handler as `el.$$name`
// (plus `el.$$nameData` when it lifted row data out of the closure) and registers the event name.
// One listener per event type at `document` walks from the target to the island or app boundary,
// calls each handler with `currentTarget` set to its element, and stops when one cancels bubbling.
// Writes made by handlers are batched until the walk ends.
import { endBatch, startBatch } from "../core/internal.ts";
import { onCleanup } from "../core/owner.ts";

type Slots = Record<string, unknown>;

/** Event type → handler slot (`$$click`) and data slot (`$$clickData`). */
const handlerKeys: Record<string, string> = {};
const dataKeys: Record<string, string> = {};

function dispatch(event: Event): void {
  const key = handlerKeys[event.type]!;
  const dataKey = dataKeys[event.type]!;
  let current: EventTarget = document;
  Object.defineProperty(event, "currentTarget", { configurable: true, get: () => current });
  startBatch();
  try {
    // `$$root` marks an island or app boundary; `$$host` leads from a portal to its logical parent.
    for (
      let node = event.target as (Node & Slots) | null;
      node !== null && node.$$root !== true;
      node = ((node.$$host as Node | null | undefined) ?? node.parentNode) as (Node & Slots) | null
    ) {
      const handler = node[key] as ((...args: unknown[]) => void) | undefined;
      if (handler !== undefined && node.disabled !== true) {
        current = node;
        if (dataKey in node) {
          handler(node[dataKey], event);
        } else {
          handler(event);
        }
        current = document;
        if (event.cancelBubble) {
          return;
        }
      }
    }
  } finally {
    current = document;
    endBatch();
  }
}

/** Registers the document-level listener of each event type once. */
export function delegateEvents(names: readonly string[]): void {
  for (const name of names) {
    if (handlerKeys[name] === undefined) {
      handlerKeys[name] = `$$${name}`;
      dataKeys[name] = `$$${name}Data`;
      document.addEventListener(name, dispatch);
    }
  }
}

/** Native listener (`on:x`, and `onX` of non-bubbling events), removed with the current owner. */
export function listen(
  el: EventTarget,
  name: string,
  handler: EventListener,
  options?: AddEventListenerOptions,
): void {
  el.addEventListener(name, handler, options);
  onCleanup(() => el.removeEventListener(name, handler, options));
}
