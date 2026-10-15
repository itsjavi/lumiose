// Element helpers: `bind:value`, `bind:checked`, `attach`, `ref` (contract doc-2 §2, spec §4.5).
import type { WritableSource } from "../contract/client.ts";
import { effect } from "../core/effect.ts";
import {
  disposeOwner,
  getOwner,
  renderEffect,
  runWithLazyOwner,
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
 * `bind:value`: the signal drives the element's value, and `input` events write it back. A number
 * signal on `type="number"` or `type="range"` reads and writes `valueAsNumber`.
 */
export function bindValue(el: ValueElement, signal: WritableSource<unknown>): void {
  const numeric =
    (el.type === "number" || el.type === "range") && typeof untrack(signal) === "number";
  const binding = numeric
    ? renderEffect(el as HTMLInputElement, signal as () => number, applyNumber)
    : renderEffect(el, signal, applyValue);
  listen(el, "input", () => {
    const value = numeric ? (el as HTMLInputElement).valueAsNumber : el.value;
    // The element already shows `value`: record it as applied, so a later write of the
    // previous value (before the next flush) is still applied.
    binding.value = value;
    signal.set(value);
  });
}

/** `bind:checked`: the signal drives `checked`, and `change` events write it back. */
export function bindChecked(el: HTMLInputElement, signal: WritableSource<boolean>): void {
  const binding = renderEffect(el, signal, applyChecked);
  listen(el, "change", () => {
    binding.value = el.checked;
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
  const binding = renderEffect(el, signal, (_, value) => {
    slots[name] = value;
  });
  const update = (event: Event): void => {
    if (event.target === el) {
      binding.value = slots[name];
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
