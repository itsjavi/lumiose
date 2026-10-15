// Option (b): the menu behaviour the platform lacks, ported from Timeless's ui-menu-button and
// ui-menu and reshaped for Lumiose. `popover` and `popovertarget` already open, close, light-dismiss
// and handle Escape before this loads; the element adds the APG keyboard contract (arrows, Home,
// End, typeahead, Tab), focus on open, and checkbox items.
//
// Unlike Timeless it keeps no per-item state and observes no mutations: listeners are delegated to
// the host and items are queried when an event needs them, so Lumiose may add, remove or rerender
// items at any time. No decorators: the file runs through Node's type stripping like the rest of
// the monorepo.

const ITEM = "[role^='menuitem']";

// The module is also imported on the server, where there is no HTMLElement to extend.
const Base = (globalThis.HTMLElement ?? Object) as typeof HTMLElement;

export interface MenuOpenChangeDetail {
  open: boolean;
}

export interface MenuCheckedChangeDetail {
  checked: boolean;
}

export class MenuElement extends Base {
  #edge: "first" | "last" = "first";
  #typed = "";
  #typedAt = 0;

  get trigger(): HTMLElement | null {
    return this.querySelector(":scope > [popovertarget]");
  }

  get popup(): HTMLElement | null {
    return this.querySelector(":scope > [popover]");
  }

  /** Whether the menu is open. Setting it opens or closes the menu; anything but a boolean is ignored. */
  get open(): boolean {
    return this.popup?.matches(":popover-open") ?? false;
  }

  set open(value: boolean | undefined) {
    if (typeof value === "boolean" && value !== this.open) this.popup?.togglePopover(value);
  }

  connectedCallback(): void {
    this.addEventListener("keydown", this);
    this.addEventListener("click", this);
    // `toggle` does not bubble: a capturing listener on the host still sees it.
    this.addEventListener("toggle", this, true);
  }

  disconnectedCallback(): void {
    this.removeEventListener("keydown", this);
    this.removeEventListener("click", this);
    this.removeEventListener("toggle", this, true);
  }

  handleEvent(event: Event): void {
    if (event.type === "toggle") this.#onToggle(event as ToggleEvent);
    else if (event.type === "click") this.#onClick(event as MouseEvent);
    else this.#onKeyDown(event as KeyboardEvent);
  }

  #items(): HTMLElement[] {
    return [...(this.popup?.querySelectorAll<HTMLElement>(ITEM) ?? [])].filter(
      (item) => !item.hidden,
    );
  }

  #onToggle(event: ToggleEvent): void {
    if (event.target !== this.popup) return;
    const open = event.newState === "open";
    this.trigger?.setAttribute("aria-expanded", String(open));
    if (open) {
      // Opening lands on the first (or, after Arrow Up, the last) item that can run; the arrows still
      // reach disabled items, as in Timeless.
      const enabled = this.#items().filter((item) => item.getAttribute("aria-disabled") !== "true");
      (this.#edge === "last" ? enabled.at(-1) : enabled[0])?.focus();
      this.#edge = "first";
    }
    this.dispatchEvent(
      new CustomEvent<MenuOpenChangeDetail>("openchange", { bubbles: true, detail: { open } }),
    );
  }

  #onClick(event: MouseEvent): void {
    const item = (event.target as Element).closest<HTMLElement>(ITEM);
    if (!item || !this.popup?.contains(item)) return;
    if (item.getAttribute("aria-disabled") === "true") {
      // Keeps the item's own handlers (Lumiose delegates them to the document) from running.
      event.stopPropagation();
      return;
    }
    if (item.getAttribute("role") === "menuitemcheckbox") {
      const checked = item.getAttribute("aria-checked") !== "true";
      item.setAttribute("aria-checked", String(checked));
      item.dispatchEvent(
        new CustomEvent<MenuCheckedChangeDetail>("checkedchange", {
          bubbles: true,
          detail: { checked },
        }),
      );
      return;
    }
    this.#close();
  }

  #onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target === this.trigger) {
      // Enter and Space open through `popovertarget`; the arrows choose the item that gets focus.
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      this.#edge = event.key === "ArrowUp" ? "last" : "first";
      this.popup?.showPopover();
      return;
    }
    if (!this.popup?.contains(target)) return;
    const items = this.#items();
    const index = items.indexOf(target);
    let next: HTMLElement | undefined;
    switch (event.key) {
      case "ArrowDown":
        next = items[(index + 1) % items.length];
        break;
      case "ArrowUp":
        next = items.at(index - 1);
        break;
      case "Home":
        next = items[0];
        break;
      case "End":
        next = items.at(-1);
        break;
      case "Tab":
        // Leaves the menu: focus continues from the trigger, as the APG asks.
        this.#close();
        return;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          next = this.#typeahead(items, index, event.key);
        }
    }
    if (next) {
      event.preventDefault();
      next.focus();
    }
  }

  #typeahead(items: HTMLElement[], index: number, key: string): HTMLElement | undefined {
    const now = Date.now();
    this.#typed = now - this.#typedAt > 500 ? key.toLowerCase() : this.#typed + key.toLowerCase();
    this.#typedAt = now;
    const ordered = [...items.slice(index + 1), ...items.slice(0, index + 1)];
    return ordered.find((item) => item.textContent?.trim().toLowerCase().startsWith(this.#typed));
  }

  #close(): void {
    const hadFocus = this.popup?.contains(document.activeElement) ?? false;
    this.popup?.hidePopover();
    if (hadFocus) this.trigger?.focus();
  }
}

if (typeof customElements !== "undefined" && !customElements.get("lu-menu")) {
  customElements.define("lu-menu", MenuElement);
}
