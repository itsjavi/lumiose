// The panels of Collapsible and Accordion, for their client scripts (doc-9 §9, TASK-370). A panel
// is the content of a `<details>`: the browser opens and closes it, whatever asks (its summary,
// find-in-page, an exclusive `name` group, the `open` prop), and this module only adds what the
// element lacks next to Base UI:
//
// - The open and close animation's measurements, as Base UI exposes them: `--lu-collapsible-panel-
//   height` and `-width` (`--lu-accordion-panel-…` in an accordion) on the panel, its content's size
//   in pixels while it opens and closes and `auto` once open; `data-starting-style` on the panel
//   for the frame an opening starts from, `data-ending-style` while it closes. A stylesheet then
//   transitions the height between 0 and the variable (the default theme does). A panel rendered
//   open does not animate: nothing changed. A change while one runs starts from where it is.
// - Disabled triggers (`aria-disabled="true"` on the summary) do not toggle.
//
// It watches the `open` attribute of every `<details>` on the page, through one
// MutationObserver: its callback runs before the next frame, so the opening transition starts from
// the starting style. Closing keeps the content visible only as long as a stylesheet
// transitions `::details-content`'s `content-visibility` (`allow-discrete`), as the theme does.
// It must not import `lumiose`: server-rendered pages load it without the runtime.
import { afterAnimations } from "../animation/animation.ts";

/** The pending end of a panel's animation: a newer change replaces it. */
const pending = new WeakMap<HTMLElement, symbol>();

/** The panel of a Collapsible or an accordion item: the child its summary controls. */
function panelOf(details: HTMLDetailsElement): HTMLElement | undefined {
  const summary = details.querySelector(":scope > summary");
  const id = summary?.getAttribute("aria-controls");
  if (!id) return undefined;
  for (const child of details.children) {
    if (child.id === id && child instanceof HTMLElement) return child;
  }
  return undefined;
}

/** The variables' prefix: an accordion item is a `<details>` right inside `<lu-accordion>`. */
const prefix = (details: HTMLDetailsElement) =>
  details.parentElement?.localName === "lu-accordion"
    ? "--lu-accordion-panel"
    : "--lu-collapsible-panel";

function measure(panel: HTMLElement, name: string) {
  panel.style.setProperty(`${name}-height`, `${panel.scrollHeight}px`);
  panel.style.setProperty(`${name}-width`, `${panel.scrollWidth}px`);
}

/** Runs `done` once the panel's animations finish, unless another change came first. */
function settle(panel: HTMLElement, done: () => void) {
  const token = Symbol();
  pending.set(panel, token);
  void afterAnimations(panel).then(() => {
    if (pending.get(panel) === token) done();
  });
}

function opened(details: HTMLDetailsElement, panel: HTMLElement) {
  const name = prefix(details);
  panel.removeAttribute("data-ending-style");
  // From 0, or from where a closing got to, to the content's height: the starting style is
  // computed first, so the transition has a value to start from.
  const fresh = !panel.style.getPropertyValue(`${name}-height`).endsWith("px");
  if (fresh) panel.setAttribute("data-starting-style", "");
  measure(panel, name);
  getComputedStyle(panel).getPropertyValue("block-size");
  panel.removeAttribute("data-starting-style");
  settle(panel, () => {
    panel.style.setProperty(`${name}-height`, "auto");
    panel.style.setProperty(`${name}-width`, "auto");
  });
}

function closed(details: HTMLDetailsElement, panel: HTMLElement) {
  const name = prefix(details);
  panel.removeAttribute("data-starting-style");
  // From the content's height (not `auto`, which does not transition) to 0.
  measure(panel, name);
  getComputedStyle(panel).getPropertyValue("block-size");
  panel.setAttribute("data-ending-style", "");
  settle(panel, () => {
    panel.removeAttribute("data-ending-style");
    // The next opening starts from 0 again.
    panel.style.setProperty(`${name}-height`, "auto");
    panel.style.setProperty(`${name}-width`, "auto");
  });
}

let watching = false;

/** Starts watching the page's panels, once. */
export function watchPanels(): void {
  if (watching) return;
  watching = true;
  new MutationObserver((records) => {
    for (const record of records) {
      const details = record.target;
      if (!(details instanceof HTMLDetailsElement)) continue;
      const panel = panelOf(details);
      // The attribute was set again without a change.
      if (!panel || (record.oldValue !== null) === details.open) continue;
      if (details.open) opened(details, panel);
      else closed(details, panel);
    }
  }).observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["open"],
    attributeOldValue: true,
  });
  // A disabled trigger: a click (Enter and Space click a summary too) does not toggle.
  document.addEventListener(
    "click",
    (event) => {
      const summary = (event.target as Element | null)?.closest?.("summary");
      if (summary?.getAttribute("aria-disabled") === "true") event.preventDefault();
    },
    true,
  );
}
