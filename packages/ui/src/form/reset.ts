// Form resets in islands (TASK-435). A native reset puts the controls back to their defaults
// without an `input` or `change` event, so a component's `onValueChange` / `onCheckedChange`, and
// a `bind:` signal through them, would keep the edited value. `onFormReset` reads the control's
// value when its form resets and again a task later, once the controls (and the elements'
// scripts, which follow the reset the same way) hold their defaults, and reports the new value
// when it differs.
import { batch, onCleanup, onMount } from "lumiose";
import { listenToForm } from "./native.ts";

const same = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((item, i) => Object.is(item, b[i]))
    : Object.is(a, b);

/** Calls `atReset` when `element`'s form resets, and what it returns a task later. */
function listen(element: () => Element | undefined, atReset: () => () => void): void {
  onMount(() => {
    const host = element();
    const form =
      (host as { form?: HTMLFormElement | null } | undefined)?.form ?? host?.closest("form");
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // In `batch()`, as the components' listeners (../batched.ts): the callbacks' writes render
    // together.
    const listener = () => {
      const later = atReset();
      clearTimeout(timer);
      timer = setTimeout(() => batch(later));
    };
    const stop = listenToForm(form, "reset", listener);
    onCleanup(() => {
      clearTimeout(timer);
      stop();
    });
  });
}

export function onFormReset<T>(
  element: () => Element | undefined,
  read: () => T,
  report: (value: T) => void,
): void {
  listen(element, () => {
    const before = read();
    return () => {
      const after = read();
      if (!same(before, after)) report(after);
    };
  });
}

/** Runs `run` a task after `element`'s form resets, once the controls hold their defaults. */
export function afterFormReset(element: () => Element | undefined, run: () => void): void {
  listen(element, () => run);
}
