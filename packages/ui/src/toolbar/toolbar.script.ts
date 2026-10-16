// Toolbar's client script (decision-62, decision-63): it defines `<lu-toolbar>`, the light-DOM
// element Toolbar.Root renders with `role="toolbar"`, after the APG toolbar pattern and Base UI:
//
// - One tab stop for the whole toolbar: its items (buttons, links, inputs, selects, the toggles of
//   a ToggleGroup inside it) have `tabindex="-1"` but one, the last focused (at first, the first).
//   Disabled items stay focusable (`aria-disabled`, as Base UI's `focusableWhenDisabled`); natively
//   disabled controls are skipped. Separators are not items.
// - The arrow keys along `data-orientation` (Left and Right swapped right to left) move focus to
//   the next or previous item, looping unless `data-loop-focus="false"`; Home and End to the first
//   and last. A control keeps the keys it needs: a text field its caret's Left and Right (focus
//   moves on at its start or end) and Home and End, a number field or a slider its arrows, a
//   select its Up and Down.
// - A ToggleGroup inside a toolbar leaves its keys and tab stop to the toolbar (toggle-group's
//   script checks for an `lu-toolbar` around it).
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.

const ITEM = "button, a[href], input:not([type=hidden]), select, textarea, [data-toolbar-item]";

/** Inputs whose Left and Right move a caret. */
const TEXT = /^(text|search|email|url|tel|password)$/;

export class ToolbarElement extends HTMLElement {
  /** The toolbar's items, in order: not those of a nested toolbar or of a popup inside it. */
  get items(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>(ITEM)].filter((item) => {
      if (item.closest("lu-toolbar") !== this) return false;
      const popup = item.closest("[popover], dialog");
      if (popup && this.contains(popup)) return false;
      return !(item as HTMLButtonElement).disabled && (item.checkVisibility?.() ?? true);
    });
  }

  connectedCallback(): void {
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("focusin", this.#onFocusIn);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.#rove(), { once: true });
    } else queueMicrotask(() => this.#rove());
  }

  disconnectedCallback(): void {
    this.removeEventListener("keydown", this.#onKeyDown);
    this.removeEventListener("focusin", this.#onFocusIn);
  }

  /** One tab stop: `to`, else the current one if it is still an item, else the first item. */
  #rove(to?: HTMLElement): void {
    const items = this.items;
    const current = items.find((item) => item.tabIndex === 0);
    const stop = to ?? current ?? items[0];
    for (const item of items) item.tabIndex = item === stop ? 0 : -1;
  }

  #onFocusIn = (event: FocusEvent) => {
    const item = this.items.find((each) => each === event.target);
    if (item) this.#rove(item);
  };

  /** Whether `item` keeps `key` for itself. */
  #owns(item: HTMLElement, key: string): boolean {
    if (item instanceof HTMLTextAreaElement) return true;
    if (item instanceof HTMLSelectElement) return key === "ArrowUp" || key === "ArrowDown";
    if (!(item instanceof HTMLInputElement)) return false;
    if (item.type === "number" || item.type === "range") return key.startsWith("Arrow");
    if (!TEXT.test(item.type)) return false;
    if (key === "Home" || key === "End") return true;
    // A text field keeps Left and Right until its caret is at the edge it moves toward.
    const { selectionStart: start, selectionEnd: end, value } = item;
    if (start === null || start !== end) return key === "ArrowLeft" || key === "ArrowRight";
    const rtl = getComputedStyle(item).direction === "rtl";
    if (key === (rtl ? "ArrowRight" : "ArrowLeft")) return start > 0;
    if (key === (rtl ? "ArrowLeft" : "ArrowRight")) return end < value.length;
    return false;
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const items = this.items;
    const item = items.find((each) => each === event.target);
    if (!item || this.#owns(item, event.key)) return;
    const vertical = this.dataset.orientation === "vertical";
    const rtl = !vertical && getComputedStyle(this).direction === "rtl";
    const steps: Record<string, number> = vertical
      ? { ArrowDown: 1, ArrowUp: -1 }
      : { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 };
    const loop = this.dataset.loopFocus !== "false";
    const at = items.indexOf(item);
    let next: number | undefined;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (steps[event.key] !== undefined) {
      next = at + steps[event.key]!;
      if (next < 0) next = loop ? items.length - 1 : 0;
      if (next >= items.length) next = loop ? 0 : items.length - 1;
    }
    if (next === undefined) return;
    event.preventDefault();
    items[next]?.focus();
  };
}

if (!customElements.get("lu-toolbar")) customElements.define("lu-toolbar", ToolbarElement);
