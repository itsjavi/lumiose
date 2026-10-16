// Button's client script (decision-62, decision-63). A Button disabled with `focusableWhenDisabled`
// stays a focusable `<button aria-disabled="true">` (a loading state keeps its place in the tab
// order and its focus), so the platform would still run its click, submit its form or reset it.
// Where this script runs, a click on such a button, from the pointer, Enter or Space, is cancelled
// before any handler sees it. A press (`pointerdown`, `mousedown`) or Enter or Space (`keydown`,
// `keyup`) reaches none of its handlers either, nor its ancestors' bubbling ones, as in Base UI
// (TASK-450 L23); listeners that capture (a layer's outside press) still see them, the press still
// focuses it, and the other keys (Tab, a toolbar's arrows) go on. Buttons with a role (menu items,
// tabs) are their widgets' to handle.
// It must not import `lumiose`: server-rendered pages load it without the runtime.

const DISABLED = "button[aria-disabled='true']:not([role])";

/** Cancels a click on an `aria-disabled` button, before Lumiose's handlers and the form's action. */
export function cancelDisabledClick(event: Event): void {
  const button = (event.target as Element).closest?.(DISABLED);
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

/** Keeps a press, Enter or Space on an `aria-disabled` button from its handlers. */
export function stopDisabledInteraction(event: Event): void {
  if (!(event.target as Element).closest?.(DISABLED)) return;
  if (event instanceof KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
  }
  event.stopPropagation();
}

document.addEventListener("click", cancelDisabledClick, true);
for (const type of ["pointerdown", "mousedown", "keydown", "keyup"]) {
  document.addEventListener(type, stopDisabledInteraction, true);
}
