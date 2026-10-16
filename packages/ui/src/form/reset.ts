// Form resets in islands (TASK-435). A native reset puts the controls back to their defaults
// without an `input` or `change` event, so a component's `onValueChange` / `onCheckedChange`, and
// a `bind:` signal through them, would keep the edited value. `onFormReset` reads the control's
// value when its form resets and again a task later, once the controls (and the elements'
// scripts, which follow the reset the same way) hold their defaults, and reports the new value
// when it differs.
import { onCleanup, onMount } from "lumiose";

const same = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((item, i) => Object.is(item, b[i]))
    : Object.is(a, b);

export function onFormReset<T>(
  element: () => Element | undefined,
  read: () => T,
  report: (value: T) => void,
): void {
  onMount(() => {
    const host = element();
    const form =
      (host as { form?: HTMLFormElement | null } | undefined)?.form ?? host?.closest("form");
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const listener = () => {
      const before = read();
      clearTimeout(timer);
      timer = setTimeout(() => {
        const after = read();
        if (!same(before, after)) report(after);
      });
    };
    form.addEventListener("reset", listener);
    onCleanup(() => {
      clearTimeout(timer);
      form.removeEventListener("reset", listener);
    });
  });
}
