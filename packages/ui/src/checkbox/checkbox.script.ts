// The client script of Checkbox, Checkbox Group, Radio Group and Switch (decision-62, decision-63).
// They render native inputs, which toggle, submit, reset and validate on their own, in server HTML
// and without JavaScript. This script closes the gaps next to Base UI (doc-9 sections 10 to 12):
//
// - Indeterminate: a checkbox's `indeterminate` is a property only, so the server renders
//   `data-indeterminate` and the script turns it into the property (mixed for assistive
//   technology, `:indeterminate` for CSS) and drops the attribute. Islands set the property.
// - A parent checkbox (`data-parent`) in a Checkbox Group: checking it checks every enabled
//   checkbox of its group, and it is checked, unchecked or indeterminate as they are. It has no
//   `name`, so it is never submitted.
// - Read-only (`aria-readonly="true"` on the input, or on a radio group): a click, Space or an arrow
//   key does not change it. Native `readonly` does not apply to checkboxes and radios.
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.

const BOX = "input[type=checkbox]";

/** The fieldset a checkbox belongs to, for a group. */
const groupOf = (input: Element) => input.closest("fieldset");

/** The group's checkboxes a parent checks and follows: enabled, not parents, not nested. */
function children(group: HTMLFieldSetElement): HTMLInputElement[] {
  return [...group.querySelectorAll<HTMLInputElement>(`${BOX}:not([data-parent])`)].filter(
    (input) => groupOf(input) === group && !input.disabled,
  );
}

/** Sets the group's parent checkboxes from their children. */
function follow(group: HTMLFieldSetElement): void {
  const boxes = children(group);
  const checked = boxes.filter((input) => input.checked).length;
  for (const parent of group.querySelectorAll<HTMLInputElement>(`${BOX}[data-parent]`)) {
    if (groupOf(parent) !== group) continue;
    parent.checked = boxes.length > 0 && checked === boxes.length;
    parent.indeterminate = checked > 0 && checked < boxes.length;
  }
}

const readOnly = (input: HTMLInputElement) =>
  input.getAttribute("aria-readonly") === "true" ||
  input.closest("[role=radiogroup]")?.getAttribute("aria-readonly") === "true";

document.addEventListener(
  "click",
  (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !/^(checkbox|radio)$/.test(input.type)) return;
    // Cancelling the click undoes the toggle, for the mouse, a label, Space and the arrow keys.
    if (readOnly(input)) event.preventDefault();
  },
  true,
);

document.addEventListener(
  "change",
  (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return;
    // A toggle ends the server's indeterminate state.
    input.removeAttribute("data-indeterminate");
    const group = groupOf(input);
    if (!group) return;
    if (input.hasAttribute("data-parent")) {
      for (const child of children(group)) child.checked = input.checked;
    }
    // Before the group's own `change` listener, which reads the checkboxes.
    follow(group);
  },
  true,
);

document.addEventListener("reset", (event) => {
  const form = event.target as HTMLFormElement;
  // The checkboxes take their default state after the event.
  setTimeout(() => {
    for (const parent of form.querySelectorAll<HTMLInputElement>(`${BOX}[data-parent]`)) {
      const group = groupOf(parent);
      if (group) follow(group);
    }
  });
});

function start() {
  for (const input of document.querySelectorAll<HTMLInputElement>(`${BOX}[data-indeterminate]`)) {
    // From here on the property, and `:indeterminate`, hold the state.
    input.indeterminate = true;
    input.removeAttribute("data-indeterminate");
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else queueMicrotask(start);
