// Toast's client script (decision-62, decision-63): defines `<lu-toast-viewport>`, the light-DOM
// element that Toast.Viewport renders. Its toasts are its children, server-rendered (a form
// action's result) or rendered by an island from a toast manager; this script gives both the same
// behaviour, after Base UI and Zag (doc-9 §16):
//
// - Top layer: the viewport becomes a manual popover (`popover="manual"`) and shows itself, so it
//   sits above the page and dialogs, and no other popover's light dismiss closes it. A modal
//   dialog makes everything outside it inert, toasts included: while one is open, the viewport
//   moves into the topmost modal dialog and back when it closes, or when that dialog leaves the
//   page (TASK-436 M8). It has `data-swipe-ignore`, so a toast's swipe never swipes a Drawer it
//   was moved into (M7).
// - Focus: the toast that holds focus is never hidden by the limit (M9). While toasts show, the
//   stack's height is `--lu-toast-stack-block-size` on the root, which toast.css turns into the
//   page's `scroll-padding-block-end`, so a control that takes focus is scrolled clear of the
//   stack (M10).
// - Timers: a toast closes after its `data-timeout` milliseconds (`0` keeps it). Timers pause
//   while the pointer is over the viewport, while keyboard focus (`:focus-visible`) is in it, while
//   the window is in the background or the page is hidden, and resume with the time that was
//   left. A press that focuses a toast pauses it only while the pointer stays (TASK-442 L1).
// - Limit: past `data-limit` toasts (on the viewport), the older ones are hidden and paused until
//   a newer one closes. Each shown toast gets `--lu-toast-index` (0 for the first child).
// - Closing: a close button (`command="--close-toast"`), Escape in a toast, a swipe or its timer
//   fires a cancelable `close` event on the toast. An island's toast handles it (its manager
//   removes it after its exit animation); otherwise the script sets `data-ending-style`, waits
//   for the toast's animations and removes it. When the focused toast goes, focus moves to the
//   next one, or back to where it was before it entered the viewport (F6, Tab or a click).
// - Keyboard: F6 focuses the viewport; Escape there, or Shift+Tab from it, returns focus.
// - Swipe: a pointer drag in one of the toast's `data-swipe-directions` (up, down, left, right)
//   past 40px closes it. It locks to one axis, never starts on a control, and springs back when
//   it falls short or reverses: pulled back 10px or more from its farthest point, it stays
//   (TASK-442 L2). While it runs the toast has `data-swiping`, `data-swipe-direction`
//   and `--lu-toast-swipe-movement-x` or `-y`. The close button and Escape do the same without a
//   gesture (WCAG 2.5.1, 2.5.7).
// - Announcements: each toast is a live region (`role="status"`, or `role="alert"`). Safari's
//   VoiceOver misses the text of a region inserted with it, so 250ms after a toast appears the
//   script adds an invisible word joiner to its first text, a change that VoiceOver reads (as Base
//   UI does).
// - New toasts get `data-starting-style` for their first frame, for an enter animation.
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.

import { afterAnimations, startFrom } from "../animation/animation.ts";
import { CLOSE_COMMAND } from "./command.ts";

const SWIPE_THRESHOLD = 40;
/** A swipe pulled back this far (px) from its farthest point is cancelled, as in Base UI. */
const SWIPE_REVERSAL = 10;
/** U+2060, invisible: the change that makes VoiceOver read a new toast. */
const WORD_JOINER = String.fromCodePoint(0x2060);
const CONTROLS = "button, a[href], input, select, textarea, [contenteditable]";

interface Timer {
  remaining: number;
  started: number;
  handle?: ReturnType<typeof setTimeout>;
}

interface Swipe {
  toast: HTMLElement;
  pointer: number;
  x: number;
  y: number;
  axis?: "x" | "y";
  directions: string[];
  /** The longest distance from the press along the axis so far (px). */
  farthest: number;
}

const viewports = new Set<LuToastViewport>();
/** Open modal dialogs, in the order they opened: the last is on top. */
const modals: HTMLDialogElement[] = [];
let windowFocused = true;

export class LuToastViewport extends HTMLElement {
  #timers = new Map<HTMLElement, Timer>();
  #closing = new WeakSet<HTMLElement>();
  #hovered = false;
  #focused = false;
  #previous: HTMLElement | null = null;
  #focusedToast: HTMLElement | null = null;
  #swipe: Swipe | undefined;
  #observer: MutationObserver | undefined;
  /** Where the viewport belongs while a modal dialog holds it. */
  #home: Comment | undefined;
  #moving = false;
  #resize: ResizeObserver | undefined;

  /** Its toasts: its element children. */
  get toasts(): HTMLElement[] {
    return [...this.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
  }

  connectedCallback() {
    if (this.#moving) return;
    viewports.add(this);
    this.setAttribute("data-swipe-ignore", "");
    this.#resize = new ResizeObserver(() => this.#publish());
    this.#resize.observe(this);
    this.addEventListener("pointerenter", this.#onPointerEnter);
    this.addEventListener("pointerleave", this.#onPointerLeave);
    this.addEventListener("focusin", this.#onFocusIn);
    this.addEventListener("focusout", this.#onFocusOut);
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("command", this.#onCommand, true);
    this.addEventListener("click", this.#onClick);
    this.addEventListener("pointerdown", this.#onPointerDown);
    this.#observer = new MutationObserver((records) => this.#onMutations(records));
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-timeout"],
    });
    this.#show();
    this.#relocate();
    for (const toast of this.toasts) this.#added(toast, true);
    this.#layout();
  }

  disconnectedCallback() {
    if (this.#moving) return;
    // Removed with the modal dialog that held it: back home, still the page's toast region.
    if (this.#home?.isConnected) {
      this.#moving = true;
      this.#home.replaceWith(this);
      this.#home = undefined;
      this.#moving = false;
      this.#show();
      return;
    }
    viewports.delete(this);
    this.#resize?.disconnect();
    if (document.documentElement.style.getPropertyValue("--lu-toast-stack-block-size")) {
      document.documentElement.style.removeProperty("--lu-toast-stack-block-size");
    }
    this.#follow(false);
    this.#observer?.disconnect();
    for (const timer of this.#timers.values()) clearTimeout(timer.handle);
    this.#timers.clear();
  }

  /** Closes `toast`, as its close button does. */
  close(toast: HTMLElement): void {
    if (this.#closing.has(toast) || toast.parentElement !== this) return;
    this.#closing.add(toast);
    this.#stop(toast);
    if (toast.dispatchEvent(new Event("close", { cancelable: true }))) {
      toast.setAttribute("data-ending-style", "");
      void afterAnimations(toast).then(() => toast.remove());
    }
    this.#layout();
  }

  /** Focuses the viewport (F6), to come back to the focused element after. */
  focusFromHotkey(): void {
    const active = document.activeElement;
    if (!this.contains(active)) this.#previous = active instanceof HTMLElement ? active : null;
    this.focus();
  }

  /** Whether it shows a toast, for F6. */
  get active(): boolean {
    return this.toasts.some((toast) => !toast.hidden);
  }

  /** Moves into the topmost modal dialog, or back home when none is open. */
  relocate(): void {
    this.#relocate();
  }

  #show() {
    if (typeof this.showPopover !== "function") return;
    if (this.popover !== "manual") this.popover = "manual";
    if (!this.matches(":popover-open")) this.showPopover();
  }

  /** The stack's height while a toast shows, for the page's scroll padding. */
  #publish() {
    const root = document.documentElement.style;
    const height = this.active ? this.getBoundingClientRect().height : 0;
    if (height > 0) root.setProperty("--lu-toast-stack-block-size", `${Math.ceil(height)}px`);
    else root.removeProperty("--lu-toast-stack-block-size");
  }

  #relocate() {
    // A modal dialog removed from the page fires no close: it holds nothing any more.
    for (const dialog of modals.filter((each) => !each.isConnected)) {
      modals.splice(modals.indexOf(dialog), 1);
    }
    const top = modals.at(-1);
    const target = top && !top.contains(this) ? top : undefined;
    if (!target && (!this.#home || (top && top.contains(this)))) return;
    this.#moving = true;
    if (target) {
      this.#home ??= this.ownerDocument.createComment("lu-toast-viewport");
      if (!this.#home.isConnected) this.before(this.#home);
      target.append(this);
    } else if (this.#home) {
      this.#home.replaceWith(this);
      this.#home = undefined;
    }
    this.#moving = false;
    // Leaving the document hid the popover.
    this.#show();
  }

  #onMutations(records: MutationRecord[]) {
    for (const record of records) {
      if (record.type === "attributes") {
        const toast = record.target as HTMLElement;
        if (toast.parentElement === this && !this.#closing.has(toast)) this.#start(toast);
        continue;
      }
      if (record.target !== this) continue;
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement) this.#added(node, false);
      }
      for (const node of record.removedNodes) {
        if (node instanceof HTMLElement) this.#removed(node);
      }
    }
    this.#layout();
  }

  #added(toast: HTMLElement, initial: boolean) {
    // A toast rendered with the page does not animate in: nothing changed.
    if (!initial) startFrom(toast);
    setTimeout(() => {
      if (!toast.isConnected) return;
      // Inside its first text (its title), not as a loose node a grid would lay out on its own.
      const text = [...toast.querySelectorAll("*")].find(
        (element) =>
          element.children.length === 0 &&
          element.textContent!.trim() &&
          !element.closest(CONTROLS),
      );
      (text ?? toast).append(WORD_JOINER);
    }, 250);
    this.#start(toast);
  }

  #removed(toast: HTMLElement) {
    this.#stop(toast);
    if (this.#focusedToast !== toast) return;
    this.#focusedToast = null;
    const next = this.toasts.find((each) => !each.hidden && !this.#closing.has(each));
    const target = next?.querySelector<HTMLElement>(CONTROLS) ?? this.#previous;
    if (target?.isConnected) target.focus({ preventScroll: true });
    else if (this.active) this.focus({ preventScroll: true });
    // Removing the focused element fires no `focusout` in every browser.
    const active = document.activeElement;
    this.#focused = this.contains(active) && active!.matches(":focus-visible");
  }

  /** Starts the toast's timer again, from its `data-timeout`. */
  #start(toast: HTMLElement) {
    this.#stop(toast);
    const timeout = Number(toast.dataset["timeout"] ?? "5000");
    if (!(timeout > 0)) return;
    this.#timers.set(toast, { remaining: timeout, started: 0 });
    this.#run(toast);
  }

  #stop(toast: HTMLElement) {
    clearTimeout(this.#timers.get(toast)?.handle);
    this.#timers.delete(toast);
  }

  #paused(): boolean {
    return this.#hovered || this.#focused || !windowFocused || document.hidden;
  }

  #run(toast: HTMLElement) {
    const timer = this.#timers.get(toast);
    if (!timer || timer.handle !== undefined || toast.hidden || this.#paused()) return;
    timer.started = performance.now();
    timer.handle = setTimeout(() => this.close(toast), timer.remaining);
  }

  #pause(toast: HTMLElement) {
    const timer = this.#timers.get(toast);
    if (!timer || timer.handle === undefined) return;
    clearTimeout(timer.handle);
    timer.handle = undefined;
    timer.remaining = Math.max(0, timer.remaining - (performance.now() - timer.started));
  }

  /** Applies the pause state to every timer. */
  syncTimers(): void {
    for (const toast of this.#timers.keys()) {
      if (this.#paused() || toast.hidden) this.#pause(toast);
      else this.#run(toast);
    }
    this.toggleAttribute("data-expanded", this.#hovered || this.#focused);
  }

  /** Hides the toasts past the limit, numbers the shown ones and updates the timers. */
  #layout() {
    const limit = Number(this.dataset["limit"] ?? "3");
    // The focused toast stays shown, past the limit too: hiding it would drop focus to the page.
    const focused = this.#toastOf(document.activeElement);
    let index = 0;
    for (const toast of this.toasts) {
      if (this.#closing.has(toast)) continue;
      const limited = limit > 0 && index >= limit && toast !== focused;
      toast.hidden = limited;
      toast.toggleAttribute("data-limited", limited);
      if (limited) toast.style.removeProperty("--lu-toast-index");
      else toast.style.setProperty("--lu-toast-index", String(index));
      index += 1;
    }
    this.syncTimers();
  }

  #toastOf(node: EventTarget | null): HTMLElement | undefined {
    if (!(node instanceof Node)) return undefined;
    return this.toasts.find((toast) => toast.contains(node));
  }

  #onPointerEnter = () => {
    this.#hovered = true;
    this.syncTimers();
  };

  #onPointerLeave = () => {
    this.#hovered = false;
    this.syncTimers();
  };

  #onFocusIn = (event: FocusEvent) => {
    // Where focus came from, to return to when the toasts it went to are gone.
    const from = event.relatedTarget;
    if (from instanceof HTMLElement && !this.contains(from)) this.#previous = from;
    this.#focused = (event.target as Element).matches(":focus-visible");
    this.#focusedToast = this.#toastOf(event.target) ?? null;
    this.syncTimers();
  };

  #onFocusOut = (event: FocusEvent) => {
    if (this.contains(event.relatedTarget as Node | null)) return;
    this.#focused = false;
    // A toast that leaves takes focus with it: `#removed` moves focus on, so keep track of it.
    if (event.relatedTarget !== null) this.#focusedToast = null;
    this.syncTimers();
  };

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      const toast = this.#toastOf(event.target);
      if (toast) this.close(toast);
      else if (event.target === this) this.#previous?.focus({ preventScroll: true });
      else return;
      event.preventDefault();
    } else if (event.key === "Tab" && event.shiftKey && event.target === this && this.#previous) {
      event.preventDefault();
      this.#previous.focus({ preventScroll: true });
    }
  };

  #onCommand = (event: Event) => {
    if ((event as Event & { command?: string }).command !== CLOSE_COMMAND) return;
    const toast = this.#toastOf(event.target);
    if (toast) this.close(toast);
  };

  /** Where the browser lacks invoker commands, the close button's click does it. */
  #onClick = (event: MouseEvent) => {
    if ("command" in HTMLButtonElement.prototype) return;
    const button = (event.target as Element | null)?.closest?.("button[command]");
    if (button?.getAttribute("command") !== CLOSE_COMMAND) return;
    const toast = this.#toastOf(button);
    if (toast) this.close(toast);
  };

  #onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const toast = this.#toastOf(event.target);
    if (!toast || this.#closing.has(toast)) return;
    if ((event.target as Element).closest(CONTROLS)) return;
    const directions = (toast.dataset["swipeDirections"] ?? "").split(/\s+/).filter(Boolean);
    if (directions.length === 0) return;
    this.#swipe = {
      toast,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      directions,
      farthest: 0,
    };
    this.#follow(true);
  };

  /**
   * While a press may become a swipe, the document's pointer events follow it, wherever the
   * pointer goes (pointer capture would, but WebKit then stops dispatching Playwright's mouse).
   */
  #follow(on: boolean) {
    const listeners = [
      ["pointermove", this.#onPointerMove],
      ["pointerup", this.#onPointerUp],
      ["pointercancel", this.#onPointerCancel],
    ] as const;
    for (const [type, listener] of listeners) {
      if (on) document.addEventListener(type, listener, true);
      else document.removeEventListener(type, listener, true);
    }
  }

  #onPointerMove = (event: PointerEvent) => {
    const swipe = this.#swipe;
    if (!swipe || event.pointerId !== swipe.pointer) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (!swipe.axis) {
      if (Math.hypot(dx, dy) < 6) return;
      const axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      const along = axis === "x" ? ["left", "right"] : ["up", "down"];
      if (!swipe.directions.some((direction) => along.includes(direction))) {
        this.#swipe = undefined;
        this.#follow(false);
        return;
      }
      swipe.axis = axis;
      swipe.toast.setAttribute("data-swiping", "");
      // Text the press began to select would be dragged by the next press (Firefox cancels the
      // pointer then): a swipe selects nothing.
      getSelection()?.removeAllRanges();
    }
    const delta = swipe.axis === "x" ? dx : dy;
    const direction =
      swipe.axis === "x" ? (delta > 0 ? "right" : "left") : delta > 0 ? "down" : "up";
    // Against an allowed direction it moves a little, as a hint that it does not go that way.
    const movement = swipe.directions.includes(direction) ? delta : delta / 8;
    swipe.farthest = Math.max(swipe.farthest, Math.abs(delta));
    swipe.toast.style.setProperty(`--lu-toast-swipe-movement-${swipe.axis}`, `${movement}px`);
    swipe.toast.setAttribute("data-swipe-direction", direction);
  };

  #onPointerUp = (event: PointerEvent) => {
    const swipe = this.#swipe;
    if (!swipe || event.pointerId !== swipe.pointer) return;
    this.#swipe = undefined;
    this.#follow(false);
    if (!swipe.axis) return;
    const delta = swipe.axis === "x" ? event.clientX - swipe.x : event.clientY - swipe.y;
    const direction =
      swipe.axis === "x" ? (delta > 0 ? "right" : "left") : delta > 0 ? "down" : "up";
    swipe.toast.removeAttribute("data-swiping");
    const reversed = swipe.farthest - Math.abs(delta) >= SWIPE_REVERSAL;
    if (swipe.directions.includes(direction) && Math.abs(delta) >= SWIPE_THRESHOLD && !reversed) {
      this.close(swipe.toast);
    } else this.#reset(swipe.toast);
  };

  #onPointerCancel = (event: PointerEvent) => {
    const swipe = this.#swipe;
    if (!swipe || event.pointerId !== swipe.pointer) return;
    this.#swipe = undefined;
    this.#follow(false);
    swipe.toast.removeAttribute("data-swiping");
    this.#reset(swipe.toast);
  };

  #reset(toast: HTMLElement) {
    toast.removeAttribute("data-swipe-direction");
    toast.style.removeProperty("--lu-toast-swipe-movement-x");
    toast.style.removeProperty("--lu-toast-swipe-movement-y");
  }
}

function relocateAll() {
  for (const viewport of viewports) viewport.relocate();
}

if (!customElements.get("lu-toast-viewport")) {
  customElements.define("lu-toast-viewport", LuToastViewport);
  // Modal dialogs: the viewport follows the topmost one, where it is not inert.
  modals.push(...document.querySelectorAll<HTMLDialogElement>("dialog:modal"));
  new MutationObserver((records) => {
    let changed = false;
    for (const record of records) {
      const dialog = record.target;
      if (!(dialog instanceof HTMLDialogElement)) continue;
      const at = modals.indexOf(dialog);
      if (at !== -1) modals.splice(at, 1);
      if (dialog.open && dialog.matches(":modal")) modals.push(dialog);
      changed = true;
    }
    if (changed) relocateAll();
  }).observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["open"],
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "F6" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const viewport = [...viewports].find((each) => each.isConnected && each.active);
    if (!viewport) return;
    event.preventDefault();
    viewport.focusFromHotkey();
  });
  const pause = () => {
    for (const viewport of viewports) viewport.syncTimers();
  };
  window.addEventListener("blur", () => {
    windowFocused = false;
    pause();
  });
  window.addEventListener("focus", () => {
    windowFocused = true;
    pause();
  });
  document.addEventListener("visibilitychange", pause);
}
