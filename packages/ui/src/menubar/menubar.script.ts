// Menubar's client script (decision-62, decision-63). `<lu-menubar role="menubar">` holds Menus,
// whose `lu-menu` elements (../menu/menu.script.ts) run each menu; it adds the WAI-ARIA menubar
// pattern's bar behaviour, after Base UI's Menubar:
//
// - One tab stop: the item focused last (the first at first) keeps `tabindex="0"`, the others get
//   `-1`. Without this script every trigger stays a tab stop.
// - On an item: Arrow Right and Left (Down and Up when vertical; swapped right to left) move
//   between the items, looping unless `data-loop-focus="false"`; Home and End; a letter moves to the
//   next item starting with it. A menu that is open follows: moving opens the next item's menu.
// - In an open menu: Arrow Right and Left on an item that opens no submenu (Menu's script handles
//   the ones that do) close it and open the next or previous item's menu on its first item; in a
//   vertical bar, the arrow pointing back closes the menu and returns to its item.
// - Pointer: once a menu is open, hovering another item opens its menu instead.
// - `data-has-submenu-open` on the bar while one of its menus is open.
// It must not import `lumiose`: server-rendered pages load it without the runtime.

import type { MenuElement } from "../menu/menu.script.ts";

const enabled = (item: Element) =>
  item.getAttribute("aria-disabled") !== "true" && !item.matches(":disabled");

export class MenubarElement extends HTMLElement {
  connectedCallback(): void {
    this.addEventListener("keydown", this);
    this.addEventListener("pointerover", this);
    this.addEventListener("focusin", this);
    // `openchange` does not bubble: the capture phase sees each menu's.
    this.addEventListener("openchange", this, true);
    // The element may connect while the page is still parsing, before its items: it makes the bar
    // one tab stop once the document has loaded (or after the current task, in an island).
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.#start(), { once: true });
    } else {
      queueMicrotask(() => this.#start());
    }
  }

  #start(): void {
    if (!this.isConnected) return;
    const items = this.#items();
    this.#rove(items.find((item) => item.tabIndex === 0) ?? items[0]);
  }

  disconnectedCallback(): void {
    this.removeEventListener("keydown", this);
    this.removeEventListener("pointerover", this);
    this.removeEventListener("focusin", this);
    this.removeEventListener("openchange", this, true);
  }

  handleEvent(event: Event): void {
    switch (event.type) {
      case "keydown":
        return this.#onKeyDown(event as KeyboardEvent);
      case "pointerover":
        return this.#onPointerOver(event as PointerEvent);
      case "focusin": {
        const item = event.target as HTMLElement;
        if (this.#items().includes(item)) this.#rove(item);
        return;
      }
      default:
        this.toggleAttribute("data-has-submenu-open", this.#openMenu() !== undefined);
    }
  }

  /** The bar's items: its menus' triggers, in order, without natively disabled ones. */
  #items(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>("[role=menuitem]")].filter(
      (item) =>
        item.closest("lu-menubar") === this &&
        item.closest("[role=menu]") === null &&
        !item.matches(":disabled"),
    );
  }

  #menuOf(item: HTMLElement): MenuElement | null {
    return item.closest<MenuElement>("lu-menu");
  }

  /** The bar's open menu, if any. */
  #openMenu(): MenuElement | undefined {
    for (const item of this.#items()) {
      const menu = this.#menuOf(item);
      if (menu?.open) return menu;
    }
    return undefined;
  }

  /** Makes `item` the bar's one tab stop. */
  #rove(item: HTMLElement | undefined): void {
    if (!item) return;
    for (const other of this.#items()) other.tabIndex = other === item ? 0 : -1;
  }

  /** The item `step` places from `from` (wrapping unless the bar does not loop). */
  #step(items: HTMLElement[], from: number, step: number): HTMLElement | undefined {
    const next = from + step;
    if (this.dataset.loopFocus === "false") return items[next];
    return items[(next + items.length) % items.length];
  }

  /** Moves to `item`; with `open`, opens its menu on its first item (closing the open one). */
  #go(item: HTMLElement | undefined, open: boolean): void {
    if (!item) return;
    const current = this.#openMenu();
    if (current && current !== this.#menuOf(item)) current.open = false;
    this.#rove(item);
    item.focus();
    const menu = this.#menuOf(item);
    if (open && menu && enabled(item) && !menu.open) menu.show(true);
  }

  #onKeyDown(event: KeyboardEvent): void {
    if (event.isComposing || event.defaultPrevented || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    const items = this.#items();
    const vertical = this.getAttribute("aria-orientation") === "vertical";
    const rtl = this.matches(":dir(rtl)");
    const [next, previous] = vertical
      ? ["ArrowDown", "ArrowUp"]
      : rtl
        ? ["ArrowLeft", "ArrowRight"]
        : ["ArrowRight", "ArrowLeft"];
    const index = items.indexOf(target);
    if (index >= 0) {
      // On an item of the bar.
      const open = this.#openMenu() !== undefined;
      let to: HTMLElement | undefined;
      if (event.key === next) to = this.#step(items, index, 1);
      else if (event.key === previous) to = this.#step(items, index, -1);
      else if (event.key === "Home") to = items[0];
      else if (event.key === "End") to = items.at(-1);
      else if (event.key.length === 1 && event.key !== " " && !event.altKey) {
        const key = event.key.toLowerCase();
        const ordered = [...items.slice(index + 1), ...items.slice(0, index + 1)];
        to = ordered.find((item) => item.textContent?.trim().toLowerCase().startsWith(key));
      } else return;
      event.preventDefault();
      this.#go(to, open);
      return;
    }
    // In one of the bar's open menus, on an item that opens no submenu.
    const menu = this.#openMenu();
    const trigger = menu ? items.find((item) => this.#menuOf(item) === menu) : undefined;
    if (!menu || !trigger || !target.closest("[role=menu]")) return;
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    if (vertical) {
      if (event.key !== back) return;
      event.preventDefault();
      menu.open = false;
      trigger.focus();
      return;
    }
    if (event.key !== next && event.key !== previous) return;
    const to = this.#step(items, items.indexOf(trigger), event.key === next ? 1 : -1);
    if (!to) return;
    event.preventDefault();
    this.#go(to, true);
  }

  /** Once a menu is open, hovering another item of the bar opens its menu instead. */
  #onPointerOver(event: PointerEvent): void {
    if (event.pointerType === "touch") return;
    const item = (event.target as Element).closest?.<HTMLElement>("[role=menuitem]");
    if (!item || !this.#items().includes(item) || !enabled(item)) return;
    const current = this.#openMenu();
    const menu = this.#menuOf(item);
    if (!current || !menu || current === menu) return;
    current.open = false;
    this.#rove(item);
    menu.show(false);
  }
}

if (!customElements.get("lu-menubar")) {
  customElements.define("lu-menubar", MenubarElement);
}
