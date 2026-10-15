// Button's client script (decision-62, decision-63). A Button disabled with `focusableWhenDisabled`
// stays a focusable `<button aria-disabled="true">` (a loading state keeps its place in the tab
// order and its focus), so the platform would still run its click, submit its form or reset it.
// Where this script runs, a click on such a button, from the pointer, Enter or Space, is cancelled
// before any handler sees it. Buttons with a role (menu items, tabs) are their widgets' to handle.
// It must not import `lumiose`: server-rendered pages load it without the runtime.

/** Cancels a click on an `aria-disabled` button, before Lumiose's handlers and the form's action. */
export function cancelDisabledClick(event: Event): void {
  const button = (event.target as Element).closest?.("button[aria-disabled='true']:not([role])");
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

document.addEventListener("click", cancelDisabledClick, true);
