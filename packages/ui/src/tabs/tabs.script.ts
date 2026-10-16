// Tabs' client script (decision-62, decision-63): defines `<lu-tabs>`, the light-DOM element that
// Tabs.Root renders, which upgrades the server HTML in place. The DOM is its only state: the tab
// with `aria-selected="true"` is the selected one, its `value` attribute the value, and each tab
// controls its panel (`aria-controls`). It follows the APG tabs pattern and Base UI (doc-9 §8):
//
// - Roving tabindex: the selected tab is the tab stop; arrow keys move focus along the
//   orientation (`aria-orientation` on the tab list), swapped in right-to-left, Home and End go
//   to the ends, and focus loops unless the list has `data-loop-focus="false"`.
// - Activation: on click, Enter or Space (manual, Base UI's default), or on focus when the list
//   has `data-activate-on-focus`. Only the main button activates. Disabled tabs
//   (`aria-disabled="true"`) take focus but are never selected; a selected tab that is disabled
//   gives its selection to the first enabled tab, and with every tab disabled none is selected.
//   Once the element's content is parsed, the selected tab (else the first) is the only tab stop
//   and the only selected tab, whatever the server HTML had (TASK-437 M17).
// - `value` reads and sets the selection; a change by the user fires `valuechange` (not
//   bubbling), so `bind:value` works on the element too.
// - With a `[data-indicator]` in the list (Tabs.Indicator, TASK-395): the selected tab's box, from
//   the list's padding edge, as `--lu-tabs-indicator-left`, `-top`, `-width` and `-height` on the
//   element, kept current as the selection changes (by this script or by an island re-rendering
//   `aria-selected`), as the list or a tab resizes, and as a `dir` attribute changes in the page. CSS anchor positioning (tabs.css) places the
//   indicator before this script runs; the variables take over then, so a theme can transition
//   them, and they place it where anchor positioning is missing.
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.

const enabled = (tab: HTMLElement) => tab.getAttribute("aria-disabled") !== "true";

export class LuTabs extends HTMLElement {
  /** The elements with an indicator, and one observer of `dir` for them all: it moves the tabs. */
  static #measured = new Set<LuTabs>();
  static #direction: MutationObserver | undefined;

  #resize: ResizeObserver | undefined;
  #mutation: MutationObserver | undefined;

  /** Its own tab list: nested tabs belong to their own element. */
  get list(): HTMLElement | null {
    for (const list of this.querySelectorAll<HTMLElement>("[role=tablist]")) {
      if (list.closest("lu-tabs") === this) return list;
    }
    return null;
  }

  get tabs(): HTMLElement[] {
    const list = this.list;
    return list
      ? [...list.querySelectorAll<HTMLElement>("[role=tab]")].filter(
          (tab) => tab.closest("lu-tabs") === this,
        )
      : [];
  }

  /** The selected tab's value, or `null` when none is selected. */
  get value(): string | null {
    return (
      this.tabs
        .find((tab) => tab.getAttribute("aria-selected") === "true")
        ?.getAttribute("value") ?? null
    );
  }

  set value(next: string | null) {
    this.#select(this.tabs.find((tab) => tab.getAttribute("value") === next));
  }

  connectedCallback() {
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("click", this.#onClick);
    this.addEventListener("focusin", this.#onFocusIn);
    // Server HTML may select a disabled tab or leave the tab stop elsewhere: fix it once the
    // element's content is parsed.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.#settle(), { once: true });
    } else queueMicrotask(() => this.#settle());
  }

  disconnectedCallback() {
    this.removeEventListener("keydown", this.#onKeyDown);
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("focusin", this.#onFocusIn);
    this.#resize?.disconnect();
    this.#mutation?.disconnect();
    this.#resize = this.#mutation = undefined;
    LuTabs.#measured.delete(this);
    if (LuTabs.#measured.size === 0) {
      LuTabs.#direction?.disconnect();
      LuTabs.#direction = undefined;
    }
  }

  #settle() {
    const tabs = this.tabs;
    const selected = tabs.find(
      (tab) => tab.getAttribute("aria-selected") === "true" && enabled(tab),
    );
    this.#select(selected ?? tabs.find(enabled), true);
    const list = this.list;
    if (list && this.#indicator() && !this.#resize) {
      // The tabs' sizes change with fonts, text and the viewport, and an island may select a tab
      // or add one by rendering: the indicator follows.
      const resize = new ResizeObserver(() => this.#measure());
      const observe = () => {
        resize.observe(list);
        for (const tab of this.tabs) resize.observe(tab);
      };
      observe();
      this.#resize = resize;
      this.#mutation = new MutationObserver(() => {
        observe();
        this.#measure();
      });
      this.#mutation.observe(list, {
        subtree: true,
        childList: true,
        attributeFilter: ["aria-selected"],
      });
      LuTabs.#measured.add(this);
      if (!LuTabs.#direction) {
        LuTabs.#direction = new MutationObserver(() => {
          for (const each of LuTabs.#measured) each.#measure();
        });
        LuTabs.#direction.observe(document.documentElement, {
          subtree: true,
          attributeFilter: ["dir"],
        });
      }
    }
    this.#measure();
  }

  #indicator(): HTMLElement | null {
    const indicator = this.list?.querySelector<HTMLElement>(":scope > [data-indicator]");
    return indicator ?? null;
  }

  /** Writes the selected tab's box, from the list's padding edge, for the indicator. */
  #measure() {
    const list = this.list;
    const indicator = this.#indicator();
    if (!list || !indicator) return;
    const tab = this.tabs.find((each) => each.getAttribute("aria-selected") === "true");
    indicator.hidden = !tab;
    if (!tab) return;
    const outer = list.getBoundingClientRect();
    const inner = tab.getBoundingClientRect();
    const left = inner.left - outer.left - list.clientLeft + list.scrollLeft;
    const top = inner.top - outer.top - list.clientTop + list.scrollTop;
    this.style.setProperty("--lu-tabs-indicator-left", `${left}px`);
    this.style.setProperty("--lu-tabs-indicator-top", `${top}px`);
    this.style.setProperty("--lu-tabs-indicator-width", `${inner.width}px`);
    this.style.setProperty("--lu-tabs-indicator-height", `${inner.height}px`);
  }

  /** Selects `tab` (nothing when it is missing or disabled), and reports a change if asked. */
  #select(tab: HTMLElement | undefined, report = false) {
    if (tab && !enabled(tab)) return;
    const before = this.value;
    const tabs = this.tabs;
    for (const each of tabs) {
      const on = each === tab;
      each.setAttribute("aria-selected", String(on));
      each.tabIndex = on || (!tab && each === tabs[0]) ? 0 : -1;
      const panel = document.getElementById(each.getAttribute("aria-controls") ?? "");
      if (panel) panel.hidden = !on;
    }
    this.#measure();
    if (report && this.value !== before) this.dispatchEvent(new Event("valuechange"));
  }

  /** The tab an event happened on, if it is one of this element's own tabs. */
  #tabOf(event: Event): HTMLElement | undefined {
    const tab = (event.target as Element).closest?.<HTMLElement>("[role=tab]");
    return tab && tab.closest("lu-tabs") === this && this.tabs.includes(tab) ? tab : undefined;
  }

  #onClick = (event: MouseEvent) => {
    const tab = this.#tabOf(event);
    if (!tab || event.button !== 0) return;
    this.#select(tab, true);
  };

  #onFocusIn = (event: FocusEvent) => {
    const tab = this.#tabOf(event);
    if (tab && this.list?.hasAttribute("data-activate-on-focus")) this.#select(tab, true);
  };

  #onKeyDown = (event: KeyboardEvent) => {
    const tab = this.#tabOf(event);
    if (!tab || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const list = this.list!;
    const vertical = list.getAttribute("aria-orientation") === "vertical";
    const rtl = !vertical && getComputedStyle(list).direction === "rtl";
    const keys: Record<string, number> = vertical
      ? { ArrowDown: 1, ArrowUp: -1 }
      : { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 };
    const tabs = this.tabs;
    const at = tabs.indexOf(tab);
    const step = keys[event.key];
    let next: number;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else if (step !== undefined) {
      next = at + step;
      const loop = list.getAttribute("data-loop-focus") !== "false";
      if (next < 0 || next >= tabs.length) next = loop ? (next + tabs.length) % tabs.length : at;
    } else return;
    event.preventDefault();
    tabs[next]!.focus();
  };
}

if (!customElements.get("lu-tabs")) customElements.define("lu-tabs", LuTabs);
