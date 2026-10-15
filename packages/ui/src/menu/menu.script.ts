// Menu's client script (decision-62, shipped through the client-script import of decision-63): it
// defines `lu-menu`, the light-DOM element that adds what a popover menu lacks. The trigger's
// `popovertarget` already opens and closes the popup, puts it in the top layer and light-dismisses
// it, in server HTML and with no JavaScript. The element adds the APG Menu Button contract and Base
// UI's behaviour (doc-9, sections 1 and 5):
//
// - Dismissal: the popup becomes a manual popover when the element opens it, and the element
//   light-dismisses it on a main-button press and release outside (native light dismiss also
//   closes on a right-click and cannot be canceled), closes submenus with their parent and with
//   their siblings, and closes on a close request (`CloseWatcher`, where the browser has it).
// - Placement: where CSS anchor positioning is missing, the shared ../placement/place.ts places
//   an open popup next to its trigger, and again on scroll and resize.
// - Focus: a keyboard opening focuses the first item that can run (Arrow Up: the last one), a
//   pointer opening the popup; closing returns focus to the trigger, without scrolling, unless an
//   outside press landed on something focusable. Once defined, the element toggles the popup on
//   the trigger's click itself, so focus moves in before the next key.
// - Keys: arrows (looping), Home, End, typeahead, Escape (one level), Tab and Shift+Tab (close the
//   menu), and Arrow Right and Left to open and close submenus (swapped right to left).
// - Items: running one closes the whole menu and returns focus before its handlers run; checkbox
//   and radio items set `aria-checked`, fire `checkedchange` and stay open; `aria-disabled` items
//   can be highlighted but do not run. `data-highlighted` follows focus.
// - Pointer: hovering highlights; a mouse press on the trigger opens the menu and releasing on an
//   item runs it; submenus open on hover and stay open while the pointer heads for them.
//
// Unlike Timeless it keeps no per-item state and observes no mutations: listeners are delegated to
// the element and items are queried when an event needs them, so Lumiose may add, remove or
// rerender items at any time. It must not import `lumiose`: server-rendered pages load it without
// the runtime.

import { anchoring, place } from "../placement/place.ts";

const ITEM = "[role^='menuitem']";
/** Typed characters add up into one search until this pause (ms), as in Base UI. */
const TYPEAHEAD_RESET = 750;
/** Hovering a submenu trigger opens its submenu after this delay (ms), as in Base UI. */
const HOVER_DELAY = 100;
/** A release on an item this soon (ms) after a press opened the menu does not run it. */
const RELEASE_DELAY = 200;
/** How long (ms) the pointer may rest on its way to an open submenu before a sibling takes over. */
const INTENT_TIMEOUT = 300;

/** Where focus goes when the menu opens. */
type Edge = "first" | "last" | "popup" | "none";

export interface MenuOpenChangeDetail {
  open: boolean;
}

export interface MenuCheckedChangeDetail {
  checked: boolean;
}

const enabled = (item: Element) => item.getAttribute("aria-disabled") !== "true";
const label = (item: HTMLElement) =>
  (item.dataset.label ?? item.textContent ?? "").trim().toLowerCase();
/** The events the element listens to on itself, besides `click` and `toggle` (capturing). */
const EVENTS = ["keydown", "pointerdown", "pointermove", "pointerout", "focusin", "focusout"];
const FOCUSABLE = "button, a[href], input, select, textarea, [tabindex], [contenteditable]";

/** Chrome 126 and Firefox 149; not in TypeScript's DOM types yet. */
declare const CloseWatcher: (new () => EventTarget & { destroy(): void }) | undefined;

/** Whether `p` is inside the triangle `a`, `b`, `c`. */
function inside(p: Point, a: Point, b: Point, c: Point): boolean {
  const side = (u: Point, v: Point) => (p.x - v.x) * (u.y - v.y) - (u.x - v.x) * (p.y - v.y);
  const [d1, d2, d3] = [side(a, b), side(b, c), side(c, a)];
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

interface Point {
  x: number;
  y: number;
}

export class MenuElement extends HTMLElement {
  /** Where focus goes when the popup opens; set by whatever opened it. */
  #edge: Edge | undefined;
  #typed = "";
  #typedAt = -Infinity;
  /** A pending hover opening of this submenu. */
  #hoverTimer: ReturnType<typeof setTimeout> | undefined;
  /** A pending move to a sibling item while the pointer heads for an open submenu. */
  #intentTimer: ReturnType<typeof setTimeout> | undefined;
  /** The last pointer position over the trigger of an open submenu. */
  #exit: Point | undefined;
  /** When a mouse press on the trigger opened the menu, until the press ends. */
  #pressedAt: number | undefined;
  /** The last press on the page while the menu is open. */
  #outside: Element | undefined;
  /** Whether that press was a main-button press outside the menu, which light-dismisses it. */
  #dismiss = false;
  /** Closes the menu on a close request (Escape elsewhere, the Android back gesture). */
  #watcher: { destroy(): void } | undefined;

  /** The menu's popup: its first `[role=menu][popover]`. */
  get popup(): HTMLElement | null {
    return this.querySelector<HTMLElement>("[role=menu][popover]");
  }

  /** The button whose `popovertarget` is the popup. */
  get trigger(): HTMLElement | null {
    const id = this.popup?.id;
    return id ? this.querySelector<HTMLElement>(`[popovertarget="${CSS.escape(id)}"]`) : null;
  }

  /** Whether the menu is open. Setting it opens or closes the menu; anything but a boolean is ignored. */
  get open(): boolean {
    return this.popup?.matches(":popover-open") ?? false;
  }

  set open(value: boolean | undefined) {
    const popup = this.popup;
    if (typeof value !== "boolean" || value === this.open || !popup?.isConnected) return;
    if (value) this.#show("first");
    else this.#hide(popup.contains(document.activeElement));
  }

  connectedCallback(): void {
    for (const type of EVENTS) {
      this.addEventListener(type, this);
    }
    // Before the items' own handlers, which Lumiose delegates to the document.
    this.addEventListener("click", this, true);
    // `toggle` does not bubble: a capturing listener on the element still sees it.
    this.addEventListener("toggle", this, true);
  }

  disconnectedCallback(): void {
    for (const type of EVENTS) {
      this.removeEventListener(type, this);
    }
    this.removeEventListener("click", this, true);
    this.removeEventListener("toggle", this, true);
    this.#listen(false);
    this.#watcher?.destroy();
    clearTimeout(this.#hoverTimer);
    clearTimeout(this.#intentTimer);
  }

  handleEvent(event: Event): void {
    switch (event.type) {
      case "keydown":
        return this.#onKeyDown(event as KeyboardEvent);
      case "click":
        return this.#onClick(event as MouseEvent);
      case "pointerdown":
        if (event.currentTarget === document) this.#onOutsidePress(event as PointerEvent);
        else this.#onPress(event as PointerEvent);
        return;
      case "pointerup":
        return this.#onRelease(event as PointerEvent);
      case "pointermove":
        return this.#onPointerMove(event as PointerEvent);
      case "pointerout":
        return this.#onPointerOut(event as PointerEvent);
      case "toggle":
        return this.#onToggle(event as ToggleEvent);
      case "scroll":
      case "resize":
        return this.#place();
      default: {
        // focusin, focusout: the highlight follows focus.
        const item = event.target as HTMLElement;
        if (item.matches(ITEM) && this.#owns(item)) {
          item.toggleAttribute("data-highlighted", event.type === "focusin");
        }
      }
    }
  }

  /** The menu whose popup holds this menu's trigger, for a submenu. */
  #parent(): MenuElement | null {
    return this.parentElement?.closest<MenuElement>("lu-menu") ?? null;
  }

  #root(): MenuElement {
    const parent = this.#parent();
    return parent ? parent.#root() : this;
  }

  /** Whether `node` belongs to this menu's popup rather than to a submenu inside it. */
  #owns(node: Element): boolean {
    const popup = this.popup;
    return popup !== null && node.closest("[role=menu]") === popup;
  }

  /** The items of the popup, without hidden, natively disabled or submenu items. */
  #items(): HTMLElement[] {
    const popup = this.popup;
    if (!popup) return [];
    return [...popup.querySelectorAll<HTMLElement>(ITEM)].filter(
      (item) =>
        item.closest("[role=menu]") === popup &&
        item.getClientRects().length > 0 &&
        !item.matches(":disabled"),
    );
  }

  /** The open submenu whose trigger is one of this menu's items. */
  #openChild(): MenuElement | undefined {
    for (const item of this.#items()) {
      const child = item.closest<MenuElement>("lu-menu");
      if (child !== this && child?.open) return child;
    }
    return undefined;
  }

  #show(edge: Edge): void {
    const popup = this.popup!;
    // The server HTML's `popover="auto"` light-dismisses on any button and has no filters: where
    // the element runs, the popup is a manual popover and the element dismisses it (#onRelease),
    // closes the submenus it opened and their siblings, and listens for close requests.
    const parent = this.#parent();
    const sibling = parent ? parent.#openChild() : undefined;
    if (sibling) sibling.#hide(false);
    popup.setAttribute("popover", "manual");
    this.#edge = edge;
    // `source` makes the trigger the invoker, as a click on it would.
    (popup.showPopover as (options?: { source?: HTMLElement | null }) => void)({
      source: this.trigger,
    });
    this.#place();
    this.#listen(true);
    if (typeof CloseWatcher === "function") {
      const watcher = new CloseWatcher();
      watcher.addEventListener("close", () => this.#hide(popup.contains(document.activeElement)));
      this.#watcher = watcher;
    }
    this.#focus(edge);
    this.#edge = "none";
  }

  /** Closes this menu and its submenus, focusing its trigger first when `returnFocus`. */
  #hide(returnFocus: boolean): void {
    if (!this.open) return;
    const child = this.#openChild();
    if (child) child.#hide(false);
    // Moving focus out first keeps the popover from restoring it to whatever had it on opening.
    if (returnFocus) this.trigger?.focus({ preventScroll: true });
    // Now, not on `toggle` a task later: the next close request belongs to the layer below.
    this.#watcher?.destroy();
    this.#watcher = undefined;
    this.popup!.hidePopover();
  }

  /**
   * The presses on the page that light-dismiss the menu, while it is open, and the scrolling and
   * resizing that move its trigger where the script places the popup.
   */
  #listen(on: boolean): void {
    const method = on ? "addEventListener" : "removeEventListener";
    for (const type of ["pointerdown", "pointerup"]) document[method](type, this, true);
    if (!anchoring) for (const type of ["scroll", "resize"]) window[method](type, this, true);
  }

  /** Places the popup next to its trigger where CSS anchor positioning is missing. */
  #place(): void {
    const trigger = this.trigger;
    if (!anchoring && trigger && this.open) place(this.popup!, trigger);
  }

  #focus(edge: Edge): void {
    if (edge === "none") return;
    const items = this.#items();
    const runnable = items.filter(enabled);
    const item =
      edge === "first"
        ? (runnable[0] ?? items[0])
        : edge === "last"
          ? (runnable.at(-1) ?? items.at(-1))
          : undefined;
    if (item) item.focus();
    else this.popup?.focus({ preventScroll: true });
  }

  #onToggle(event: ToggleEvent): void {
    const popup = this.popup;
    if (!popup || event.target !== popup) return;
    const open = event.newState === "open";
    this.trigger?.setAttribute("aria-expanded", String(open));
    if (open) {
      const edge = this.#edge ?? "first";
      this.#edge = undefined;
      this.#place();
      this.#focus(edge);
    } else {
      this.#listen(false);
      this.#watcher?.destroy();
      clearTimeout(this.#intentTimer);
      this.#edge = this.#pressedAt = this.#watcher = undefined;
      this.#dismiss = false;
      for (const item of popup.querySelectorAll("[data-highlighted]")) {
        item.removeAttribute("data-highlighted");
      }
      // Light dismiss leaves focus on the page: back to the trigger, unless the press landed on
      // something focusable (Safari and Firefox on macOS do not focus a pressed button).
      const active = document.activeElement;
      if ((!active || active === document.body) && !this.#outside?.closest(FOCUSABLE)) {
        this.trigger?.focus({ preventScroll: true });
      }
    }
    this.dispatchEvent(new CustomEvent<MenuOpenChangeDetail>("openchange", { detail: { open } }));
  }

  #onKeyDown(event: KeyboardEvent): void {
    if (event.isComposing || event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    const popup = this.popup;
    if (!popup) return;
    const rtl = popup.matches(":dir(rtl)");
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    if (this.trigger?.contains(target)) {
      // Enter and Space open the menu through `popovertarget`; the arrows choose the item that
      // gets focus. A submenu opens with the arrow that points at it; its parent handles the rest.
      const sub = this.#parent() !== null;
      const opens = sub ? event.key === forward : /^Arrow(Down|Up)$/.test(event.key);
      if (!opens || !enabled(this.trigger!)) return;
      event.preventDefault();
      const edge = event.key === "ArrowUp" ? "last" : "first";
      if (this.open) this.#focus(edge);
      else this.#show(edge);
      return;
    }
    if (!this.#owns(target)) return;
    const items = this.#items();
    const index = items.indexOf(target);
    let next: HTMLElement | undefined;
    switch (event.key) {
      case "ArrowDown":
        next = items[(index + 1) % items.length];
        break;
      case "ArrowUp":
        next = items.at(index < 0 ? -1 : index - 1);
        break;
      case "Home":
        next = items[0];
        break;
      case "End":
        next = items.at(-1);
        break;
      case rtl ? "ArrowRight" : "ArrowLeft":
        if (this.#parent()) {
          event.preventDefault();
          this.#hide(true);
        }
        return;
      case "Escape": {
        // One level at a time: a submenu opened by hover closes before its parent.
        event.preventDefault();
        const child = this.#openChild();
        if (child) child.#hide(false);
        else this.#hide(true);
        return;
      }
      case "Tab":
        // Leaves the whole menu. Tab moves on from the trigger, Shift+Tab stays on it.
        if (event.shiftKey) event.preventDefault();
        this.#root().#hide(true);
        return;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        const typing = event.timeStamp - this.#typedAt < TYPEAHEAD_RESET;
        // Space runs the item, except while typing, where it is part of the text.
        if (event.key === " " && !typing) return;
        event.preventDefault();
        next = this.#typeahead(items, index, event.key.toLowerCase(), typing, event.timeStamp);
      }
    }
    if (next) {
      event.preventDefault();
      next.focus();
    }
  }

  #typeahead(
    items: HTMLElement[],
    index: number,
    key: string,
    typing: boolean,
    now: number,
  ): HTMLElement | undefined {
    // Repeating a letter cycles through the items that start with it; more letters refine the
    // match from the current item.
    const typed = typing ? this.#typed + key : key;
    const repeated = [...typed].every((char) => char === key);
    this.#typed = repeated ? key : typed;
    this.#typedAt = now;
    const start = repeated ? index + 1 : Math.max(index, 0);
    const ordered = [...items.slice(start), ...items.slice(0, start)];
    return ordered.find((item) => label(item).startsWith(this.#typed));
  }

  #onClick(event: MouseEvent): void {
    const target = event.target as Element;
    const trigger = this.trigger;
    if (trigger?.contains(target)) {
      // The element opens and closes the menu itself rather than through `popovertarget`, so
      // focus moves in at once: the popover's `toggle` event comes a task later, after keys the
      // user may already have typed. A click with no detail comes from Enter or Space.
      event.preventDefault();
      const keyboard = event.detail === 0;
      if (this.#parent()) {
        // A click keeps a submenu opened by hover open; Enter and Space move into it.
        if (!this.open) this.#show(keyboard ? "first" : "none");
        else if (keyboard) this.#focus("first");
      } else if (this.#pressedAt !== undefined && !keyboard) {
        // The press already opened the menu.
        this.#pressedAt = undefined;
      } else if (this.open) {
        this.#hide(false);
      } else {
        this.#show(keyboard ? "first" : "popup");
      }
      return;
    }
    const item = target.closest<HTMLElement>(ITEM);
    if (!item || !this.#owns(item)) return;
    if (!enabled(item)) {
      // Keeps the item's own handlers, a link's navigation and a submenu's toggle from running.
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    // A submenu trigger: its own menu handles it.
    if (item.hasAttribute("popovertarget")) return;
    const role = item.getAttribute("role");
    let close = item.dataset.closeOnClick
      ? item.dataset.closeOnClick === "true"
      : role === "menuitem";
    if (role === "menuitemcheckbox") {
      this.#check(item, item.getAttribute("aria-checked") !== "true");
    } else if (role === "menuitemradio") {
      if (item.getAttribute("aria-checked") !== "true") {
        const group = item.closest("[role=group], [role=menu]")!;
        for (const radio of group.querySelectorAll("[role=menuitemradio][aria-checked=true]")) {
          if (radio.closest("[role=group], [role=menu]") === group) {
            radio.setAttribute("aria-checked", "false");
          }
        }
        this.#check(item, true);
      }
    } else if (
      item.localName === "a" &&
      (event.ctrlKey || event.metaKey || event.shiftKey || item.hasAttribute("download"))
    ) {
      // The link opens elsewhere: the menu stays, as in Zag.
      close = false;
    }
    if (close) this.#root().#hide(true);
  }

  #check(item: HTMLElement, checked: boolean): void {
    item.setAttribute("aria-checked", String(checked));
    item.dispatchEvent(
      new CustomEvent<MenuCheckedChangeDetail>("checkedchange", {
        bubbles: true,
        detail: { checked },
      }),
    );
  }

  /**
   * Any press on the page while the menu is open: only a main-button press outside the menu, and
   * its release outside too, light-dismisses it (#onRelease), as in Base UI and Zag.
   */
  #onOutsidePress(event: PointerEvent): void {
    const target = event.target as Element;
    this.#outside = target;
    this.#dismiss = event.button === 0 && event.isPrimary && !this.contains(target);
  }

  /** A mouse press on the trigger opens the menu at once, so a drag can release on an item. */
  #onPress(event: PointerEvent): void {
    this.#pressedAt = undefined;
    const trigger = this.trigger;
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      this.#parent() ||
      this.open ||
      !trigger?.contains(event.target as Node) ||
      trigger.matches(":disabled")
    ) {
      return;
    }
    // No mousedown: the trigger would take focus back from the popup.
    event.preventDefault();
    this.#pressedAt = event.timeStamp;
    this.#show("popup");
  }

  #onRelease(event: PointerEvent): void {
    const pressedAt = this.#pressedAt;
    const target = event.target as Element;
    if (pressedAt === undefined) {
      if (this.#dismiss && !this.contains(target)) this.#hide(false);
      this.#dismiss = false;
      return;
    }
    // A release on the trigger is a click: the menu stays open.
    if (this.trigger?.contains(target)) return;
    this.#pressedAt = undefined;
    const popup = this.popup;
    const item = target.closest?.<HTMLElement>(ITEM);
    if (item && popup?.contains(item)) {
      if (event.timeStamp - pressedAt >= RELEASE_DELAY) item.click();
    } else if (!popup?.contains(target)) {
      this.#hide(true);
    }
  }

  #onPointerMove(event: PointerEvent): void {
    // Keyboard scrolling under a resting pointer moves nothing (WebKit fires zero-delta moves).
    if (event.pointerType === "touch" || (event.movementX === 0 && event.movementY === 0)) return;
    clearTimeout(this.#intentTimer);
    const target = event.target as Element;
    const trigger = this.trigger;
    if (this.#parent() && trigger?.contains(target) && !this.open && enabled(trigger)) {
      this.#hoverTimer ??= setTimeout(() => {
        this.#hoverTimer = undefined;
        if (!this.open && this.isConnected) this.#show("none");
      }, HOVER_DELAY);
    }
    const item = target.closest?.<HTMLElement>(ITEM);
    if (!item || !this.#owns(item)) return;
    const child = this.#openChild();
    if (child?.trigger === item) {
      this.#exit = { x: event.clientX, y: event.clientY };
    } else if (child) {
      // On the way to the open submenu, the items it crosses do not close it.
      if (this.#exit && this.#towards(child, event)) {
        this.#intentTimer = setTimeout(() => this.#highlight(item, child), INTENT_TIMEOUT);
        return;
      }
      this.#exit = undefined;
    }
    this.#highlight(item, child);
  }

  #highlight(item: HTMLElement, child: MenuElement | undefined): void {
    if (child && child.trigger !== item) child.#hide(false);
    if (document.activeElement !== item) item.focus({ preventScroll: true });
  }

  /** Whether the pointer is in the triangle between its exit from the trigger and the submenu. */
  #towards(child: MenuElement, event: PointerEvent): boolean {
    const box = child.popup!.getBoundingClientRect();
    const exit = this.#exit!;
    const x = exit.x <= box.left ? box.left : box.right;
    return inside(
      { x: event.clientX, y: event.clientY },
      exit,
      { x, y: box.top },
      { x, y: box.bottom },
    );
  }

  #onPointerOut(event: PointerEvent): void {
    if (event.pointerType === "touch") return;
    const target = event.target as Element;
    const to = event.relatedTarget as Element | null;
    const trigger = this.trigger;
    if (this.#parent() && trigger?.contains(target) && !trigger.contains(to)) {
      clearTimeout(this.#hoverTimer);
      this.#hoverTimer = undefined;
    }
    const item = target.closest?.<HTMLElement>(ITEM);
    if (!item || !this.#owns(item) || item.contains(to) || to?.closest(ITEM)) return;
    // Leaving the items clears the highlight, except on the way into an open submenu.
    if (this.#openChild()?.trigger === item) return;
    if (document.activeElement === item) this.popup?.focus({ preventScroll: true });
  }
}

if (!customElements.get("lu-menu")) customElements.define("lu-menu", MenuElement);
