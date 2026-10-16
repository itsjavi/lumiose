// Context Menu's client script (decision-62, decision-63): defines `<lu-context-menu>`, the
// light-DOM element that ContextMenu.Root renders around its trigger area and its menu. The menu
// is Menu's own `<lu-menu>` (../menu/menu.script.ts, which this module loads): its keys, items,
// typeahead, submenus and dismissal (../layer/layer.ts). This element only opens it, where Base UI
// and Zag open a context menu (doc-9 §5):
//
// - A right-click (`contextmenu`) in the trigger area opens the menu at the pointer, instead of
//   the browser's menu; another one moves it there. The popup is anchored to a fixed, zero-size
//   element that the element puts at the pointer (`--lu-context-x`, `--lu-context-y`), so CSS
//   anchor positioning places it with Menu's flips; elsewhere ../placement/place.ts does.
// - A long press on a touch screen (500ms without moving 10px, one finger) opens it at the
//   finger: iOS fires no `contextmenu`, and the `contextmenu` Android fires after it is ignored.
// - The keyboard (WCAG 2.5.1): Shift+F10 or the ContextMenu key, with focus in the trigger area,
//   opens it at the focused element and focuses its first item.
// - Focus: a keyboard opening focuses the first item, a pointer one the popup (Menu's rules). With
//   no trigger to return to, closing returns focus to where it was before the menu opened, unless
//   it already moved elsewhere (an outside press on a control).
// - A right-click inside the open menu shows neither menu.
// - `data-disabled` on the element leaves the browser's menu alone.
// - Nested: in the area of a context menu inside another's, the inner one opens (unless it is
//   disabled, where the outer one does).
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.
import "../menu/menu.script.ts";
import type { MenuElement } from "../menu/menu.script.ts";
import { anchoring, place } from "../placement/place.ts";

/** How long (ms) a touch rests before it opens the menu, and how far (px) it may move. */
const LONG_PRESS = 500;
const SLOP = 10;

interface Press {
  pointer: number;
  x: number;
  y: number;
  timer: ReturnType<typeof setTimeout>;
}

export class ContextMenuElement extends HTMLElement {
  #press: Press | undefined;
  /** The element focused before the menu opened, to return focus to. */
  #previous: HTMLElement | null = null;
  /** When a long press opened the menu: the `contextmenu` that follows it on Android is ignored. */
  #pressedAt = -Infinity;

  /** The menu: its `<lu-menu>`. */
  get menu(): MenuElement | null {
    return this.querySelector<MenuElement>(":scope > lu-menu, :scope > * > lu-menu");
  }

  connectedCallback(): void {
    for (const type of ["contextmenu", "keydown", "pointerdown", "pointermove", "pointerup"]) {
      this.addEventListener(type, this);
    }
    this.addEventListener("pointercancel", this);
    // The menu's `openchange` does not bubble: a capturing listener still sees it.
    this.addEventListener("openchange", this, true);
  }

  disconnectedCallback(): void {
    for (const type of ["contextmenu", "keydown", "pointerdown", "pointermove", "pointerup"]) {
      this.removeEventListener(type, this);
    }
    this.removeEventListener("pointercancel", this);
    this.removeEventListener("openchange", this, true);
    this.#cancel();
  }

  handleEvent(event: Event): void {
    const menu = this.menu;
    if (event.type === "openchange") {
      // The menu's own, not a submenu's: focus left with the popup, or stayed in it.
      if (event.target !== menu || (event as CustomEvent<{ open: boolean }>).detail.open) return;
      const active = document.activeElement;
      if (!active || active === document.body || menu?.contains(active)) {
        this.#previous?.focus({ preventScroll: true });
      }
      this.#previous = null;
      return;
    }
    if (!menu || this.hasAttribute("data-disabled")) return;
    const target = event.target as Node;
    // A context menu nested in this one's area opens instead (TASK-437 M15).
    const owner = (target instanceof Element ? target : target.parentElement)?.closest(
      "lu-context-menu:not([data-disabled])",
    );
    if (owner !== this) return;
    const inMenu = menu.contains(target);
    switch (event.type) {
      case "contextmenu": {
        event.preventDefault();
        if (inMenu || event.timeStamp - this.#pressedAt < 1000) return;
        const pointer = event as MouseEvent;
        // A keyboard's `contextmenu` (where Shift+F10 was not caught below) has no pointer.
        const keyboard = pointer.detail === 0 && pointer.clientX === 0 && pointer.clientY === 0;
        if (keyboard) this.#openAtFocus(target);
        else this.#open(pointer.clientX, pointer.clientY, false);
        break;
      }
      case "keydown": {
        const key = event as KeyboardEvent;
        const opens = key.key === "ContextMenu" || (key.key === "F10" && key.shiftKey);
        if (!opens || inMenu || key.altKey || key.ctrlKey || key.metaKey) return;
        event.preventDefault();
        this.#openAtFocus(target);
        break;
      }
      case "pointerdown": {
        const pointer = event as PointerEvent;
        if (this.#press) {
          // A second finger: not a long press.
          this.#cancel();
          return;
        }
        if (inMenu || pointer.pointerType === "mouse" || !pointer.isPrimary) return;
        const { clientX: x, clientY: y, pointerId } = pointer;
        this.#press = {
          pointer: pointerId,
          x,
          y,
          timer: setTimeout(() => {
            this.#press = undefined;
            this.#pressedAt = performance.now();
            this.#open(x, y, false);
          }, LONG_PRESS),
        };
        break;
      }
      case "pointermove": {
        const pointer = event as PointerEvent;
        const press = this.#press;
        if (press?.pointer !== pointer.pointerId) return;
        if (Math.hypot(pointer.clientX - press.x, pointer.clientY - press.y) > SLOP) this.#cancel();
        break;
      }
      default:
        if (this.#press?.pointer === (event as PointerEvent).pointerId) this.#cancel();
    }
  }

  #cancel(): void {
    if (this.#press) clearTimeout(this.#press.timer);
    this.#press = undefined;
  }

  /** Opens the menu below the start of the focused element, as from the keyboard. */
  #openAtFocus(target: Node): void {
    const element = target instanceof Element ? target : target.parentElement;
    const box = (element ?? this).getBoundingClientRect();
    this.#open(box.left, box.bottom, true);
  }

  /** Opens the menu at `x`, `y` (viewport pixels), or moves it there when it is open. */
  #open(x: number, y: number, keyboard: boolean): void {
    const menu = this.menu!;
    if (!menu.open) {
      const active = document.activeElement;
      this.#previous = active instanceof HTMLElement && active !== document.body ? active : null;
    }
    this.style.setProperty("--lu-context-x", `${x}px`);
    this.style.setProperty("--lu-context-y", `${y}px`);
    menu.show(keyboard);
    const popup = menu.popup;
    if (!anchoring && popup) {
      place(popup, { getBoundingClientRect: () => new DOMRect(x, y, 0, 0) } as Element);
    }
  }
}

if (!customElements.get("lu-context-menu")) {
  customElements.define("lu-context-menu", ContextMenuElement);
}
