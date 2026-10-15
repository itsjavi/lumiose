// Accordion's client script (decision-62, decision-63): defines `<lu-accordion>`, the light-DOM
// element that Accordion.Root renders, and starts the panels' animation hooks and disabled triggers
// (../collapsible/panel.ts). The items are native `<details>` right inside it, so opening and
// closing, the exclusive group (`name`) and find-in-page need no script. The element adds the
// optional keys of the APG Accordion pattern, as Base UI and Zag have them (doc-9 §9):
//
// - Down and Up move focus to the next and the previous trigger (Right and Left when the root has
//   `data-orientation="horizontal"`, swapped in right-to-left); Home and End to the first and the
//   last. Focus loops unless the root has `data-loop-focus="false"`.
// - Disabled triggers (`aria-disabled="true"`) are skipped.
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.
import { watchPanels } from "../collapsible/panel.ts";

watchPanels();

const enabled = (trigger: HTMLElement) => trigger.getAttribute("aria-disabled") !== "true";

export class LuAccordion extends HTMLElement {
  /** The triggers of its own items, in order. */
  get triggers(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>(":scope > details > summary")];
  }

  connectedCallback() {
    this.addEventListener("keydown", this.#onKeyDown);
  }

  disconnectedCallback() {
    this.removeEventListener("keydown", this.#onKeyDown);
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const triggers = this.triggers;
    const current = triggers.indexOf(event.target as HTMLElement);
    if (current === -1) return;
    const horizontal = this.dataset["orientation"] === "horizontal";
    const rtl = getComputedStyle(this).direction === "rtl";
    const forward = horizontal ? (rtl ? "ArrowLeft" : "ArrowRight") : "ArrowDown";
    const backward = horizontal ? (rtl ? "ArrowRight" : "ArrowLeft") : "ArrowUp";
    const loop = this.dataset["loopFocus"] !== "false";
    const usable = triggers.filter(enabled);
    let next: HTMLElement | undefined;
    if (event.key === "Home") next = usable[0];
    else if (event.key === "End") next = usable.at(-1);
    else if (event.key === forward || event.key === backward) {
      const step = event.key === forward ? 1 : -1;
      for (let at = current + step; ; at += step) {
        if (at < 0 || at >= triggers.length) {
          if (!loop) break;
          at = at < 0 ? triggers.length - 1 : 0;
        }
        if (at === current) break;
        if (enabled(triggers[at]!)) {
          next = triggers[at];
          break;
        }
      }
    } else return;
    event.preventDefault();
    next?.focus();
  };
}

if (!customElements.get("lu-accordion")) customElements.define("lu-accordion", LuAccordion);
