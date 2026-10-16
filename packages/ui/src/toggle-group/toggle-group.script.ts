// ToggleGroup's client script (decision-62, decision-63): it defines `<lu-toggle-group>`, the
// light-DOM element ToggleGroup renders around its toggles, native `<button aria-pressed>`s that
// the platform cannot press. After Base UI and doc-9 section 13:
//
// - A click (the pointer, Enter, Space) on a toggle fires a cancelable, bubbling `pressedchange`
//   (`detail.pressed`) on it and, unless it is cancelled, flips `aria-pressed`. One toggle is
//   pressed at a time (pressing it again releases it), or any number with `multiple`.
// - `value` (the pressed toggles' values) and a `valuechange` event after the user changes it.
// - One tab stop, moved by the arrow keys along `data-orientation` (swapped right to left), Home
//   and End, looping unless `data-loop-focus="false"`. Disabled toggles are native `disabled`
//   buttons, which focus skips.
//
// A Toggle outside a group needs no script: the component presses it, in an island. Inside a
// Toolbar (`lu-toolbar`), the group still presses its toggles but leaves the tab stop and the
// arrow keys to the toolbar, whose items its toggles are.
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.

export interface ToggleChangeDetail {
  pressed: boolean;
}

const ITEM = "button[aria-pressed]";

const pressed = (item: Element) => item.getAttribute("aria-pressed") === "true";

/** Asks with a cancelable `pressedchange` whether `item` may become `next`, and sets it if so. */
function press(item: HTMLElement, next: boolean): boolean {
  const ok = item.dispatchEvent(
    new CustomEvent<ToggleChangeDetail>("pressedchange", {
      bubbles: true,
      cancelable: true,
      detail: { pressed: next },
    }),
  );
  if (ok) item.setAttribute("aria-pressed", String(next));
  return ok;
}

export class ToggleGroupElement extends HTMLElement {
  /** The group's own toggles: nested groups keep theirs. */
  get items(): HTMLButtonElement[] {
    return [...this.querySelectorAll<HTMLButtonElement>(ITEM)].filter(
      (item) => item.closest("lu-toggle-group") === this,
    );
  }

  /** The pressed toggles' values. Setting it presses those toggles, without events. */
  get value(): string[] {
    return this.items.filter(pressed).map((item) => item.value);
  }

  set value(next: readonly string[] | null | undefined) {
    const values = next ?? [];
    for (const item of this.items)
      item.setAttribute("aria-pressed", String(values.includes(item.value)));
    this.#rove();
  }

  /** Whether several toggles can be pressed; reflects the `multiple` attribute. */
  get multiple(): boolean {
    return this.hasAttribute("multiple");
  }

  set multiple(on: boolean) {
    this.toggleAttribute("multiple", on);
  }

  connectedCallback(): void {
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("focusin", this.#onFocusIn);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.#rove(), { once: true });
    } else queueMicrotask(() => this.#rove());
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.removeEventListener("focusin", this.#onFocusIn);
  }

  /** Whether a Toolbar around the group moves focus instead. */
  get #inToolbar(): boolean {
    return this.closest("lu-toolbar") !== null;
  }

  /** One tab stop: `to`, else the current one if still usable, else the first pressed or enabled. */
  #rove(to?: HTMLElement): void {
    if (this.#inToolbar) return;
    const items = this.items;
    const usable = items.filter((item) => !item.disabled);
    const current = usable.find((item) => item.tabIndex === 0);
    const stop = to ?? current ?? usable.find(pressed) ?? usable[0];
    for (const item of items) item.tabIndex = item === stop ? 0 : -1;
  }

  #itemOf(event: Event): HTMLButtonElement | undefined {
    const item = (event.target as Element).closest?.<HTMLButtonElement>(ITEM);
    return item && item.closest("lu-toggle-group") === this ? item : undefined;
  }

  #onClick = (event: MouseEvent) => {
    const item = this.#itemOf(event);
    if (!item || item.disabled) return;
    const next = !pressed(item);
    const before = this.value;
    if (!press(item, next)) return;
    // One at a time: pressing an item releases the others.
    if (next && !this.multiple) {
      for (const other of this.items) if (other !== item && pressed(other)) press(other, false);
    }
    this.#rove(item);
    const after = this.value;
    if (after.length !== before.length || after.some((value, i) => value !== before[i])) {
      this.dispatchEvent(new Event("valuechange"));
    }
  };

  #onFocusIn = (event: FocusEvent) => {
    const item = this.#itemOf(event);
    if (item) this.#rove(item);
  };

  #onKeyDown = (event: KeyboardEvent) => {
    if (this.#inToolbar) return;
    const item = this.#itemOf(event);
    if (!item || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const vertical = this.dataset.orientation === "vertical";
    const rtl = !vertical && getComputedStyle(this).direction === "rtl";
    const steps: Record<string, number> = vertical
      ? { ArrowDown: 1, ArrowUp: -1 }
      : { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 };
    const usable = this.items.filter((each) => !each.disabled);
    const at = usable.indexOf(item);
    const loop = this.dataset.loopFocus !== "false";
    let next: number | undefined;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = usable.length - 1;
    else if (steps[event.key] !== undefined) {
      next = at + steps[event.key]!;
      if (next < 0) next = loop ? usable.length - 1 : 0;
      if (next >= usable.length) next = loop ? 0 : usable.length - 1;
    }
    if (next === undefined) return;
    event.preventDefault();
    usable[next]?.focus();
  };
}

if (!customElements.get("lu-toggle-group")) {
  customElements.define("lu-toggle-group", ToggleGroupElement);
}
