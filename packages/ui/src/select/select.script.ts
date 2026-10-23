// Select's client script (decision-63, TASK-537), loaded by a Select whose items have a `label`.
// A customizable select's picker (`appearance: base-select`) shows an option's `label` attribute
// instead of its content, through the browser's own style, which no CSS overrides. When such a
// select is pressed or takes focus, before its picker opens, this script removes the attribute from
// the options that Select.Item rendered with a label: the picker then shows their content,
// typeahead matches the label's hidden copy first in it, and their `aria-label` keeps their name.
// The classic select keeps the attribute, which it shows and typeahead matches; so does server HTML
// before the script runs, where the customizable picker shows the label.
// It must not import `lumiose`: server-rendered pages load it without the runtime.

/** The hidden copy of a label that Select.Item puts first in its option. */
const LABELLED = "option[label] > [data-label]:first-child";

/** Shows the content of the labelled items of the customizable select at or around `target`. */
export function showContent(target: EventTarget | null): void {
  const select = (target as Element | null)?.closest?.("select");
  if (!select || getComputedStyle(select).appearance !== "base-select") return;
  for (const copy of select.querySelectorAll(LABELLED))
    copy.parentElement!.removeAttribute("label");
}

for (const type of ["pointerdown", "focusin"]) {
  document.addEventListener(type, (event) => showContent(event.target), true);
}
// A select focused before the script ran (`autofocus`).
showContent(document.activeElement);
