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
// - A Radio Group's arrow keys, after the APG: Down and Right (Left right to left) check the next
//   enabled radio, Up and Left the previous one, around the ends and past disabled radios. Native
//   radios do it too, but not the same everywhere: WebKit stops at the ends and does not mirror
//   Left and Right right to left (TASK-424).
// - `data-unchecked-value` (a Checkbox's or Switch's `uncheckedValue`): an unchecked, enabled box
//   with a name submits that value, appended to the form's data (the `formdata` event), so it
//   comes after the form's other values. Without the script it submits nothing, as natively.
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

// `formdata` does not bubble: a capturing listener sees it.
document.addEventListener(
  "formdata",
  (event) => {
    const form = event.target as HTMLFormElement;
    for (const input of form.elements) {
      if (
        input instanceof HTMLInputElement &&
        input.type === "checkbox" &&
        input.hasAttribute("data-unchecked-value") &&
        input.name &&
        !input.checked &&
        !input.matches(":disabled")
      ) {
        event.formData.append(input.name, input.getAttribute("data-unchecked-value")!);
      }
    }
  },
  true,
);

document.addEventListener("keydown", (event) => {
  const radio = event.target;
  if (!(radio instanceof HTMLInputElement) || radio.type !== "radio" || event.defaultPrevented) {
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  const group = radio.closest<HTMLElement>("[role=radiogroup]");
  if (!group) return;
  const rtl = getComputedStyle(radio).direction === "rtl";
  const steps: Record<string, number> = {
    ArrowDown: 1,
    ArrowUp: -1,
    ArrowRight: rtl ? -1 : 1,
    ArrowLeft: rtl ? 1 : -1,
  };
  const step = steps[event.key];
  if (!step) return;
  const radios = [...group.querySelectorAll<HTMLInputElement>("input[type=radio]")].filter(
    (each) =>
      each.name === radio.name &&
      each.closest("[role=radiogroup]") === group &&
      !each.matches(":disabled"),
  );
  const at = radios.indexOf(radio);
  if (at === -1) return;
  event.preventDefault();
  const next = radios[(at + step + radios.length) % radios.length]!;
  next.focus();
  // Checks it, with `input` and `change`; a read-only group cancels the click (above).
  if (next !== radio) next.click();
});

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
