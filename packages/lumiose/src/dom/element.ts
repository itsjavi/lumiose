// Element helpers: `bind:value`, `bind:checked`, `attach`, `ref` (contract doc-2 §2, spec §4.5).
import type { WritableSource } from "../contract/client.ts";
import { effect } from "../core/effect.ts";
import {
  createTrigger,
  disposeOwner,
  getOwner,
  renderEffect,
  runWithLazyOwner,
  track,
  trigger,
  type Owner,
} from "../core/internal.ts";
import { untrack } from "../core/reactive.ts";
import { listen } from "./events.ts";

type ValueElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

// Writes skip values the element already shows, so typing never moves the caret.
function applyValue(el: ValueElement, value: unknown): void {
  const text = value == null ? "" : String(value);
  if (el.value !== text) {
    el.value = text;
  }
}

function applyNumber(el: HTMLInputElement, value: number): void {
  if (!Object.is(el.valueAsNumber, value)) {
    el.valueAsNumber = value;
  }
}

function applyChecked(el: HTMLInputElement, value: unknown): void {
  el.checked = !!value;
}

/**
 * The render effect of a two-way binding, and what its event calls with the value the element now
 * shows, before writing the signal. That value is recorded as applied, and the effect re-runs at
 * the next flush even if the signal ends where it was: code that writes the previous value back
 * before the flush (typing "b" over "a", then `set("a")`) still reaches the element (TASK-388).
 */
function twoWay<E, T>(
  el: E,
  signal: () => T,
  apply: (el: E, value: T) => void,
): (shown: T) => void {
  const again = createTrigger();
  const binding = renderEffect(
    el,
    () => {
      track(again);
      return signal();
    },
    apply,
  );
  return (shown) => {
    binding.value = shown;
    trigger(again);
  };
}

/**
 * `bind:value`: the signal drives the element's value, and `input` events write it back. A number
 * signal on `type="number"` or `type="range"` reads and writes `valueAsNumber`.
 */
export function bindValue(el: ValueElement, signal: WritableSource<unknown>): void {
  const numeric =
    (el.type === "number" || el.type === "range") && typeof untrack(signal) === "number";
  const shown = numeric
    ? twoWay(el as HTMLInputElement, signal as () => number, applyNumber)
    : twoWay(el, signal, applyValue);
  listen(el, "input", () => {
    const value = numeric ? (el as HTMLInputElement).valueAsNumber : el.value;
    (shown as (value: unknown) => void)(value);
    signal.set(value);
  });
}

/** `bind:checked`: the signal drives `checked`, and `change` events write it back. */
export function bindChecked(el: HTMLInputElement, signal: WritableSource<boolean>): void {
  const shown = twoWay(el, signal, applyChecked);
  listen(el, "change", () => {
    shown(el.checked);
    signal.set(el.checked);
  });
}

/**
 * `bind:x` on a custom element (decision-62): the signal drives the element's `x` property, and
 * the `input`, `change` and `xchange` events it dispatches (lowercase: `openchange`) write the
 * property back. Events bubbling up from its children are ignored.
 */
export function bindProperty(el: Element, name: string, signal: WritableSource<unknown>): void {
  const slots = el as unknown as Record<string, unknown>;
  const shown = twoWay(el, signal, (_, value) => {
    slots[name] = value;
  });
  const update = (event: Event): void => {
    if (event.target === el) {
      shown(slots[name]);
      signal.set(slots[name]);
    }
  };
  for (const type of ["input", "change", `${name.toLowerCase()}change`]) {
    listen(el, type, update);
  }
}

type Attachment = ((el: Element) => void | (() => void)) | false | null | undefined;

interface AttachState {
  el: Element;
  owner: Owner | undefined;
}

let attachState: AttachState | undefined;
let attachList: readonly Attachment[] = [];

function runAttachments(): void {
  const el = attachState!.el;
  for (const attachment of attachList) {
    if (attachment) {
      effect(() => attachment(el));
    }
  }
}

function applyAttachments(state: AttachState, attachments: readonly Attachment[]): void {
  const prev = state.owner;
  if (prev !== undefined) {
    state.owner = undefined;
    disposeOwner(prev);
  }
  attachState = state;
  attachList = attachments;
  state.owner = runWithLazyOwner(getOwner(), runAttachments);
  attachState = undefined;
  attachList = [];
}

/**
 * `attach={[a, b]}`: each attachment runs as an effect (after the element is mounted) and may
 * return a cleanup, which runs before it re-runs and on disposal. When the list itself changes,
 * every attachment is restarted.
 */
export function attach(el: Element, attachments: () => readonly Attachment[]): void {
  renderEffect<AttachState, readonly Attachment[]>(
    { el, owner: undefined },
    attachments,
    applyAttachments,
  );
}

/** `ref={fn}`: calls `fn(el)` once the element exists. */
export function useRef(el: Element, ref: ((el: Element) => void) | undefined): void {
  if (ref !== undefined) {
    ref(el);
  }
}
