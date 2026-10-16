// Navigation Menu's client script (decision-62, decision-63). Each item's trigger already opens its
// content through `popovertarget`, a `popover="auto"`: one at a time, closed by Escape and a click
// outside, in server HTML and without JavaScript. `<lu-navigation-menu>` adds Base UI's behaviour
// and the WAI-ARIA disclosure navigation pattern's optional keys (doc-9, sections 1 and 3):
//
// - Hover intent (mouse and pen): resting on a trigger for `data-delay` (50ms) opens its content,
//   at once while another is open; leaving the item closes it `data-close-delay` (50ms) later,
//   300ms when the pointer leaves toward the content. A click keeps a content opened by hover open
//   and makes it stay when the pointer leaves; another click closes it.
// - Keys: Arrow Right and Left (Down and Up when vertical, swapped right to left) move between the
//   top-level triggers and links, with Home and End; Arrow Down (Right when vertical) on a trigger
//   opens its content on its first link; in a content, Arrow Down and Up move between its links;
//   Escape closes it and returns to its trigger. Every trigger and link stays a tab stop.
// - Focus leaving an item for elsewhere on the page closes its content.
// - `aria-expanded` on the triggers; `data-activation-direction` (`left`, `right`, `up`, `down`) on a
//   content opened while another was, toward where its trigger is; `value` and `valuechange`.
// - Placement: where CSS anchor positioning is missing, the shared ../placement/place.ts places an
//   open content next to its trigger, and again on scroll and resize.
// It must not import `lumiose`: server-rendered pages load it without the runtime.

import { anchoring, place } from "../placement/place.ts";

/** How long (ms) the content stays while the pointer travels from its trigger toward it. */
const TRAVEL_DELAY = 300;
const FOCUSABLE = "a[href], button:not(:disabled), input, select, textarea, [tabindex]";

export interface NavigationMenuValueChangeDetail {
  value: string | null;
}

export class NavigationMenuElement extends HTMLElement {
  #openTimer: ReturnType<typeof setTimeout> | undefined;
  #closeTimer: ReturnType<typeof setTimeout> | undefined;
  /** The item whose content the pointer opened and no click has kept open yet. */
  #hovered: HTMLElement | undefined;
  /** The value last reported in `valuechange`. */
  #reported: string | null = null;

  /** The `value` of the item whose content is open, or `null`. Setting it opens or closes them. */
  get value(): string | null {
    return this.#openItem()?.dataset.value ?? null;
  }

  set value(value: string | null | undefined) {
    if (value === undefined || value === this.value) return;
    const item = value === null ? undefined : this.#items().find((i) => i.dataset.value === value);
    if (item) this.#open(item, false);
    else this.#close();
  }

  connectedCallback(): void {
    for (const type of ["pointerover", "pointerout", "keydown", "focusout"]) {
      this.addEventListener(type, this);
    }
    // Before the trigger's `popovertarget` acts, and before Lumiose's delegated handlers.
    this.addEventListener("click", this, true);
    // `toggle` does not bubble: the capture phase sees each content's.
    this.addEventListener("toggle", this, true);
  }

  disconnectedCallback(): void {
    for (const type of ["pointerover", "pointerout", "keydown", "focusout"]) {
      this.removeEventListener(type, this);
    }
    this.removeEventListener("click", this, true);
    this.removeEventListener("toggle", this, true);
    clearTimeout(this.#openTimer);
    clearTimeout(this.#closeTimer);
    this.#listen(false);
  }

  handleEvent(event: Event): void {
    switch (event.type) {
      case "scroll":
      case "resize":
        return this.#place();
      case "pointerover":
        return this.#onPointerOver(event as PointerEvent);
      case "pointerout":
        return this.#onPointerOut(event as PointerEvent);
      case "click":
        return this.#onClick(event as MouseEvent);
      case "keydown":
        return this.#onKeyDown(event as KeyboardEvent);
      case "focusout":
        return this.#onFocusOut(event as FocusEvent);
      default:
        return this.#onToggle(event as ToggleEvent);
    }
  }

  /** This menu's items (not those of a menu nested in a content). */
  #items(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>("li[data-value]")].filter(
      (item) => item.closest("lu-navigation-menu") === this,
    );
  }

  #itemOf(node: Node | null): HTMLElement | undefined {
    const item = node instanceof Element ? node.closest<HTMLElement>("li[data-value]") : null;
    return item && item.closest("lu-navigation-menu") === this ? item : undefined;
  }

  #trigger(item: HTMLElement): HTMLElement | null {
    const trigger = item.querySelector<HTMLElement>("[popovertarget]");
    return trigger && this.#itemOf(trigger) === item ? trigger : null;
  }

  #content(item: HTMLElement): HTMLElement | null {
    const id = this.#trigger(item)?.getAttribute("popovertarget");
    return id ? document.getElementById(id) : null;
  }

  #openItem(): HTMLElement | undefined {
    return this.#items().find((item) => this.#content(item)?.matches(":popover-open"));
  }

  /** Opens `item`'s content, closing the open one; `hover` when the pointer opened it. */
  #open(item: HTMLElement, hover: boolean): void {
    clearTimeout(this.#openTimer);
    clearTimeout(this.#closeTimer);
    const trigger = this.#trigger(item);
    const content = this.#content(item);
    if (!trigger || !content || trigger.matches(":disabled")) return;
    this.#hovered = hover ? item : undefined;
    if (content.matches(":popover-open")) return;
    const previous = this.#openItem();
    if (previous) {
      content.dataset.activationDirection = direction(this.#trigger(previous)!, trigger);
    } else {
      delete content.dataset.activationDirection;
    }
    (content.showPopover as (options?: { source?: HTMLElement }) => void)({ source: trigger });
  }

  #close(): void {
    clearTimeout(this.#openTimer);
    clearTimeout(this.#closeTimer);
    this.#hovered = undefined;
    const item = this.#openItem();
    if (item) this.#content(item)!.hidePopover();
  }

  #onToggle(event: ToggleEvent): void {
    const item = this.#items().find((each) => this.#content(each) === event.target);
    if (!item) return;
    this.#trigger(item)?.setAttribute("aria-expanded", String(event.newState === "open"));
    this.#place();
    this.#listen(this.#openItem() !== undefined);
    if (event.newState === "closed" && this.#hovered === item) this.#hovered = undefined;
    // Switching items closes one and opens another: report the open one once.
    const value = this.value;
    if (value === this.#reported) return;
    this.#reported = value;
    this.dispatchEvent(
      new CustomEvent<NavigationMenuValueChangeDetail>("valuechange", { detail: { value } }),
    );
  }

  /** Where CSS anchor positioning is missing, scrolling and resizing move the open content too. */
  #listen(on: boolean): void {
    if (anchoring) return;
    for (const type of ["scroll", "resize"]) {
      window[on ? "addEventListener" : "removeEventListener"](type, this, true);
    }
  }

  /** Places the open content next to its trigger where CSS anchor positioning is missing. */
  #place(): void {
    const item = this.#openItem();
    if (!anchoring && item) place(this.#content(item)!, this.#trigger(item)!);
  }

  #delay(name: "delay" | "closeDelay"): number {
    const value = Number(this.dataset[name]);
    return Number.isFinite(value) && this.dataset[name] !== undefined ? value : 50;
  }

  #onPointerOver(event: PointerEvent): void {
    if (event.pointerType === "touch") return;
    const item = this.#itemOf(event.target as Node);
    if (!item) return;
    const open = this.#openItem();
    if (open === item) {
      clearTimeout(this.#closeTimer);
      return;
    }
    const trigger = this.#trigger(item);
    if (!trigger?.contains(event.target as Node)) return;
    clearTimeout(this.#openTimer);
    if (open) this.#open(item, true);
    else this.#openTimer = setTimeout(() => this.#open(item, true), this.#delay("delay"));
  }

  #onPointerOut(event: PointerEvent): void {
    if (event.pointerType === "touch") return;
    const item = this.#itemOf(event.target as Node);
    if (!item) return;
    const to = event.relatedTarget as Node | null;
    const trigger = this.#trigger(item);
    if (trigger?.contains(event.target as Node) && !trigger.contains(to)) {
      clearTimeout(this.#openTimer);
    }
    // Still inside the item (its trigger or content), or a content kept open by a click.
    if (this.#itemOf(to) === item || this.#hovered !== item) return;
    const content = this.#content(item)!;
    const toward = trigger?.contains(event.target as Node) && heading(trigger, content, event);
    clearTimeout(this.#closeTimer);
    this.#closeTimer = setTimeout(
      () => {
        if (this.#hovered === item) this.#close();
      },
      toward ? TRAVEL_DELAY : this.#delay("closeDelay"),
    );
  }

  #onClick(event: MouseEvent): void {
    const target = event.target as Element;
    const item = this.#itemOf(target);
    if (!item) return;
    const trigger = this.#trigger(item);
    if (trigger?.contains(target)) {
      // The element toggles the content itself: a click keeps a content opened by hover open.
      event.preventDefault();
      if (this.#hovered === item) this.#hovered = undefined;
      else if (this.#openItem() === item) this.#close();
      else this.#open(item, false);
      return;
    }
    const link = target.closest<HTMLElement>("a[data-close-on-click=true]");
    if (link && this.#itemOf(link) === item) this.#close();
  }

  #onKeyDown(event: KeyboardEvent): void {
    if (event.isComposing || event.defaultPrevented || event.altKey || event.ctrlKey) return;
    if (event.metaKey) return;
    const target = event.target as HTMLElement;
    const item = this.#itemOf(target);
    if (!item) return;
    const vertical = this.dataset.orientation === "vertical";
    const rtl = this.matches(":dir(rtl)");
    const [next, previous] = vertical
      ? ["ArrowDown", "ArrowUp"]
      : rtl
        ? ["ArrowLeft", "ArrowRight"]
        : ["ArrowRight", "ArrowLeft"];
    const opens = vertical ? (rtl ? "ArrowLeft" : "ArrowRight") : "ArrowDown";
    const content = this.#content(item);
    const inContent = content?.contains(target) ?? false;

    if (event.key === "Escape" && this.#openItem() === item) {
      event.preventDefault();
      this.#close();
      this.#trigger(item)?.focus();
      return;
    }
    if (inContent) {
      // Down and Up between the content's links (not those of a menu nested in it).
      const links = [...content!.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (link) => link.closest("[popover]") === content && link.getClientRects().length > 0,
      );
      const index = links.indexOf(target);
      const to =
        event.key === "ArrowDown"
          ? links[(index + 1) % links.length]
          : event.key === "ArrowUp"
            ? links.at(index - 1)
            : undefined;
      if (index < 0 || !to) return;
      event.preventDefault();
      to.focus();
      return;
    }
    // On a top-level trigger or link.
    const tops = this.#items()
      .map((each) => {
        const own = [...each.querySelectorAll<HTMLElement>(FOCUSABLE)];
        return own.find((el) => !this.#content(each)?.contains(el) && this.#itemOf(el) === each);
      })
      .filter((el): el is HTMLElement => el !== undefined && !el.matches(":disabled"));
    const index = tops.indexOf(target);
    if (index < 0) return;
    let to: HTMLElement | undefined;
    if (event.key === next) to = tops[(index + 1) % tops.length];
    else if (event.key === previous) to = tops.at(index - 1);
    else if (event.key === "Home") to = tops[0];
    else if (event.key === "End") to = tops.at(-1);
    else if (event.key === opens && this.#trigger(item) === target && content) {
      event.preventDefault();
      this.#open(item, false);
      content.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      return;
    }
    if (!to) return;
    event.preventDefault();
    to.focus();
  }

  #onFocusOut(event: FocusEvent): void {
    const item = this.#itemOf(event.target as Node);
    const to = event.relatedTarget as Node | null;
    // Focus leaving the open item for another element of the page closes its content.
    if (!item || to === null || this.#openItem() !== item || this.#itemOf(to) === item) return;
    this.#close();
  }
}

/** Where `to` is from `from`: the direction a content opened from another one comes in from. */
function direction(from: HTMLElement, to: HTMLElement): string {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (Math.abs(b.left - a.left) >= Math.abs(b.top - a.top))
    return b.left > a.left ? "right" : "left";
  return b.top > a.top ? "down" : "up";
}

/** Whether the pointer left `trigger` through the edge that faces `content`. */
function heading(trigger: HTMLElement, content: HTMLElement, event: PointerEvent): boolean {
  const t = trigger.getBoundingClientRect();
  const c = content.getBoundingClientRect();
  if (c.top >= t.bottom - 1) return event.clientY >= t.bottom - 1;
  if (c.bottom <= t.top + 1) return event.clientY <= t.top + 1;
  if (c.left >= t.right - 1) return event.clientX >= t.right - 1;
  return event.clientX <= t.left + 1;
}

if (!customElements.get("lu-navigation-menu")) {
  customElements.define("lu-navigation-menu", NavigationMenuElement);
}
