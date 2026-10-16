// The client script of Checkbox, Checkbox Group, Radio Group and Switch (decision-62, decision-63).
// They render native inputs, which toggle, submit, reset and validate on their own, in server HTML
// and without JavaScript. This script closes the gaps next to Base UI (doc-9 sections 10 to 12):
//
// - Indeterminate: a checkbox's `indeterminate` is a property only, so the server renders
//   `data-indeterminate` and the script turns it into the property (mixed for assistive
//   technology, `:indeterminate` for CSS) and drops the attribute. Islands set the property.
// - A parent checkbox (`data-parent`) in a Checkbox Group, after Base UI's: it is checked,
//   unchecked or indeterminate as its group's checkboxes are, disabled ones counted (as the server
//   counts them). Toggling it goes from a partial selection to all, then none, then back to the
//   selection the user last made with the checkboxes; disabled checkboxes keep their state
//   (TASK-458). Its `aria-controls` names the checkboxes. It has no `name`, so it is never
//   submitted.
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

/** Checkboxes the server rendered indeterminate: a form reset puts them back (TASK-446, L11). */
const mixed = new WeakSet<HTMLInputElement>();

/** The fieldset a checkbox belongs to, for a group. */
const groupOf = (input: Element) => input.closest("fieldset");

/** The group's checkboxes a parent follows: not parents, not nested; disabled ones included. */
function children(group: HTMLFieldSetElement): HTMLInputElement[] {
  return [...group.querySelectorAll<HTMLInputElement>(`${BOX}:not([data-parent])`)].filter(
    (input) => groupOf(input) === group,
  );
}

/** Each group's checked boxes as the user last chose them, one at a time: a parent restores it. */
const chosen = new WeakMap<HTMLFieldSetElement, HTMLInputElement[]>();

const same = (a: HTMLInputElement[], b: HTMLInputElement[]) =>
  a.length === b.length && a.every((box) => b.includes(box));

/** A parent's toggle: a partial choice → all → none → the choice again (Base UI's cycle). */
function cycle(group: HTMLFieldSetElement): void {
  const boxes = children(group);
  const now = boxes.filter((box) => box.checked);
  // Disabled boxes keep their state: "none" keeps the checked ones, "all" leaves out the others.
  const none = boxes.filter((box) => box.disabled && box.checked);
  const all = boxes.filter((box) => !box.disabled || box.checked);
  const choice = chosen.get(group) ?? now;
  const partial = choice.length > 0 && choice.length < all.length;
  let next: HTMLInputElement[];
  if (!partial) next = same(now, all) ? none : all;
  else if (same(now, all)) next = none;
  else if (same(now, none)) next = choice;
  else next = all;
  for (const box of boxes) if (!box.disabled) box.checked = next.includes(box);
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
    if (input.hasAttribute("data-parent")) cycle(group);
    else
      chosen.set(
        group,
        children(group).filter((box) => box.checked),
      );
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
    for (const input of form.querySelectorAll<HTMLInputElement>(BOX)) {
      if (mixed.has(input)) input.indeterminate = true;
    }
    for (const parent of form.querySelectorAll<HTMLInputElement>(`${BOX}[data-parent]`)) {
      const group = groupOf(parent);
      if (!group) continue;
      chosen.delete(group);
      follow(group);
    }
  });
});

// Shift+Tab into a radio group with nothing checked lands on its last radio in Chromium and
// WebKit: the first enabled one takes focus instead, as Tab gives it (TASK-446, L13).
document.addEventListener("focusin", (event) => {
  const radio = event.target;
  if (!(radio instanceof HTMLInputElement) || radio.type !== "radio") return;
  const group = radio.closest<HTMLElement>("[role=radiogroup]");
  if (!group || group.contains(event.relatedTarget as Node | null)) return;
  const radios = [...group.querySelectorAll<HTMLInputElement>("input[type=radio]")].filter(
    (each) => each.name === radio.name && each.closest("[role=radiogroup]") === group,
  );
  if (radios.some((each) => each.checked)) return;
  const first = radios.find((each) => !each.matches(":disabled"));
  if (first && first !== radio) first.focus();
});

function start() {
  for (const input of document.querySelectorAll<HTMLInputElement>(`${BOX}[data-indeterminate]`)) {
    // From here on the property, and `:indeterminate`, hold the state.
    input.indeterminate = true;
    if (!input.hasAttribute("data-parent")) mixed.add(input);
    input.removeAttribute("data-indeterminate");
  }
  // A parent names its checkboxes as they are, ids of their own included.
  for (const parent of document.querySelectorAll<HTMLInputElement>(`${BOX}[data-parent]`)) {
    const group = groupOf(parent);
    if (!group) continue;
    const ids = children(group)
      .map((box) => box.id)
      .filter(Boolean);
    if (ids.length > 0) parent.setAttribute("aria-controls", ids.join(" "));
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else queueMicrotask(start);
