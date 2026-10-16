// Popover's client script (decision-62's "native gaps are closed by small scripts", shipped through
// the client-script import of decision-63). Popover works without it; on a page that renders one,
// this module runs once and closes what a native `popover="auto"` misses next to Base UI and Zag
// (doc-9), for every Popover popup on the page (`[popover][data-side][role=dialog]`):
//
// - Focus on open: the first focusable element, or the popup itself when there is none or when it
//   was opened by touch (no virtual keyboard). The browser only focuses an `autofocus` element.
// - Focus return: when closing leaves focus nowhere (a click outside on the page, WebKit not
//   focusing a clicked trigger, a trigger that is gone), focus goes to the opener, else a trigger,
//   without scrolling. A click outside on another control keeps focus there.
// - Dismissal: the dismissal model Popover shares with Menu and Combobox (layer/layer.ts). A
//   trigger's click makes the popup a manual popover before `popovertarget` opens it, so a
//   right-click or a second finger outside does not close it (native light dismiss would, and
//   cannot be cancelled); the layer model closes it on a main-button press outside, a close
//   request, or another layer opening outside it. Server HTML keeps `popover="auto"`, so the
//   browser light-dismisses it until the script runs.
// - `aria-expanded` on the triggers, following the popover.
// - Placement where CSS anchor positioning is missing (placement/place.ts).
// - Open on hover (TASK-394): a trigger with `data-open-on-hover` opens its popover after
//   `data-delay` (300 ms) of hover by a mouse or a pen, never by touch or focus, without moving
//   focus. It stays open while the pointer is on the trigger or the popup (WCAG 1.4.13: hoverable)
//   and closes `data-close-delay` (0 ms, at least a 100 ms grace to cross the gap) after it left
//   both. A click on the trigger keeps it open until it is dismissed (an outside press, Escape).
// - A modal popover is a modal `<dialog data-side>` opened by `command="show-modal"`: placement,
//   focus and `aria-expanded` as above; Dialog's script and the native dialog do the rest.
// - `data-trap-focus` (`modal="trap-focus"`, TASK-410): Tab and Shift+Tab go around the open
//   popup's tab stops (not a roving item, nor an unchecked radio of a group with a checked one),
//   and the popup stays non-modal otherwise (the page scrolls and takes presses). Focus on open
//   goes to the first tab stop too (TASK-436 M4).
// - Focus leaving a non-modal popover for elsewhere on the page (Tab past it) closes it, so it
//   covers no focused control (TASK-436 M2). Focus going nowhere is left to the outside press, and
//   focus into a toast leaves it open, as a press there does.
// - A popover a hover opened gives focus back on close only if it held focus (TASK-436 M3).
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.
import { openLayer } from "../layer/layer.ts";
import { hoverIntent } from "./hover.ts";
import { anchoring, place } from "../placement/place.ts";

/** The last press, until a key is pressed: what an opening came from. */
let press: PointerEvent | undefined;
const openers = new WeakMap<HTMLElement, HTMLElement>();
/** The popovers that held focus as they started to close. */
const holding = new WeakSet<HTMLElement>();
/** The open popovers that the fallback placement follows on scroll and resize. */
const placed = new Set<HTMLElement>();

const FOCUSABLE =
  "a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1']), [contenteditable]";

function on<K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
) {
  document.addEventListener(type, listener, true);
}

/**
 * The popup's tab stops, in order: focusable and shown, not taken out of the order (`tabindex="-1"`,
 * a roving toolbar's or toggle group's other items), and one radio per group (the checked one, or
 * the first enabled one).
 */
function tabStops(popup: HTMLElement): HTMLElement[] {
  return [...popup.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (element.tabIndex < 0 || !element.checkVisibility()) return false;
    if (!(element instanceof HTMLInputElement) || element.type !== "radio" || !element.name) {
      return true;
    }
    const group = [
      ...popup.querySelectorAll<HTMLInputElement>(
        `input[type=radio][name="${CSS.escape(element.name)}"]`,
      ),
    ].filter((radio) => !radio.disabled);
    return element === (group.find((radio) => radio.checked) ?? group[0]);
  });
}

const isPopover = (node: unknown): node is HTMLElement =>
  node instanceof HTMLElement &&
  node.matches("[popover][data-side][role=dialog], dialog[data-side]");

/** The buttons that open or toggle the popover. */
const triggers = (popup: HTMLElement) => {
  const id = CSS.escape(popup.id);
  return document.querySelectorAll<HTMLElement>(
    `[popovertarget="${id}"]:not([popovertargetaction=hide]), [commandfor="${id}"][command=show-modal]`,
  );
};

function anchor(popup: HTMLElement): HTMLElement | undefined {
  const opener = openers.get(popup);
  return opener?.isConnected ? opener : (triggers(popup)[0] ?? undefined);
}

function follow() {
  for (const popup of placed) {
    const trigger = anchor(popup);
    if (trigger) place(popup, trigger);
  }
}

on("pointerdown", (event) => (press = event));
on("keydown", () => (press = undefined));

on("keydown", (event) => {
  if (event.key !== "Tab" || event.defaultPrevented || event.altKey || event.ctrlKey) return;
  const popup = (event.target as Element).closest?.<HTMLElement>("[data-trap-focus]");
  if (!isPopover(popup) || !popup.matches(":popover-open")) return;
  const stops = tabStops(popup);
  const first = stops[0];
  const last = stops.at(-1);
  const at = event.target as HTMLElement;
  const wrap = !first
    ? popup
    : event.shiftKey
      ? at === first || at === popup
        ? last
        : undefined
      : at === last
        ? first
        : undefined;
  if (!wrap) return;
  event.preventDefault();
  wrap.focus();
});

/** Stops dismissing each open popover (layer/layer.ts). */
const layers = new Map<HTMLElement, () => void>();

// Before `popovertarget` acts: a closed popup becomes a manual popover, which the layer model
// dismisses. A key press on the trigger clicks it too. A click on the trigger of a popover its
// hover opened keeps it open instead of closing it.
on("click", (event) => {
  const trigger = (event.target as Element).closest?.<HTMLElement>("[popovertarget]");
  const popup = trigger && document.getElementById(trigger.getAttribute("popovertarget")!);
  if (!isPopover(popup) || trigger!.matches("[popovertargetaction=hide]")) return;
  if (!popup.matches(":popover-open")) popup.popover = "manual";
  else if (hovered.has(popup)) {
    event.preventDefault();
    hover.forget(popup);
  }
});

// Focus leaving an open non-modal popover (and those around it) for elsewhere on the page closes
// it; a trap-focus popover keeps focus in itself.
on("focusout", (event) => {
  const from = event.target as Node;
  const to = event.relatedTarget as Node | null;
  // Focus going nowhere is the outside press's to judge; into a toast, it leaves layers alone.
  if (!to || (to instanceof Element && to.closest("lu-toast-viewport"))) return;
  const open = document.querySelectorAll<HTMLElement>(
    "[popover][data-side][role=dialog]:popover-open:not([data-trap-focus])",
  );
  for (const popup of [...open].toReversed()) {
    if (!popup.contains(from) || popup.contains(to)) continue;
    if ([...triggers(popup)].some((trigger) => trigger.contains(to))) continue;
    popup.hidePopover();
  }
});

// Open on hover (hover.ts) -------------------------------------------------------------------

const hover = hoverIntent({
  triggerAt: (node) =>
    node.closest?.<HTMLElement>("button[data-open-on-hover][popovertarget]") ?? undefined,
  popupOf: (trigger) => {
    const popup = document.getElementById(trigger.getAttribute("popovertarget")!);
    return isPopover(popup) ? popup : undefined;
  },
  show: (trigger, popup) => {
    // A hover-opened popover leaves focus where it is (see `toggle`).
    popup.popover = "manual";
    (popup.showPopover as (options?: { source?: HTMLElement }) => void)({ source: trigger });
  },
  hide: (popup) => popup.hidePopover(),
  delay: 300,
  closeDelay: 0,
});
const hovered = hover.hovered;

/** Stops dismissing `popup`: as it closes, so the next close request goes to the layer below. */
function release(popup: HTMLElement) {
  layers.get(popup)?.();
  layers.delete(popup);
}

on("beforetoggle", (event) => {
  const popup = event.target;
  if (!isPopover(popup)) return;
  release(popup);
  if (event.newState === "closed") {
    if (popup.contains(document.activeElement)) holding.add(popup);
    return;
  }
  // Now, not on `toggle` a task later: a press right after the opening already counts.
  if (popup.popover === "manual") {
    layers.set(
      popup,
      openLayer({
        popup,
        contains: (node) =>
          popup.contains(node) || [...triggers(popup)].some((trigger) => trigger.contains(node)),
        dismiss: () => popup.hidePopover(),
      }),
    );
  }
  const active = document.activeElement;
  const pressed = press && (press.target as Element).closest?.<HTMLElement>("[popovertarget]");
  const opener = active instanceof HTMLElement && active !== document.body ? active : pressed;
  if (opener) openers.set(popup, opener);
  // Placed in the frame it first paints in, once it can be measured (`toggle` may come later).
  if (!anchoring) {
    requestAnimationFrame(() => {
      if (!popup.matches(":popover-open")) return;
      placed.add(popup);
      follow();
    });
  }
});

on("toggle", (event) => {
  const popup = event.target;
  if (!isPopover(popup)) return;
  const open = event.newState === "open";
  for (const trigger of triggers(popup)) trigger.setAttribute("aria-expanded", String(open));

  if (open) {
    // A hover opens it without taking focus from where it is.
    if (hovered.has(popup) || popup.contains(document.activeElement)) return;
    const touch = press?.pointerType === "touch" && event.timeStamp - press.timeStamp < 1000;
    const first = touch ? undefined : tabStops(popup)[0];
    if (first) first.focus();
    else {
      if (!popup.hasAttribute("tabindex")) popup.tabIndex = -1;
      popup.focus({ preventScroll: true });
    }
    return;
  }

  placed.delete(popup);
  const wasHovered = hovered.has(popup);
  const held = holding.has(popup);
  holding.delete(popup);
  hover.forget(popup);
  // A hover opened it and focus was elsewhere: closing it moves no focus.
  if (wasHovered && !held) return;
  const active = document.activeElement;
  if (active && active !== document.body && !popup.contains(active)) return;
  anchor(popup)?.focus({ preventScroll: true });
  openers.delete(popup);
});

if (!anchoring) {
  addEventListener("scroll", follow, { capture: true, passive: true });
  addEventListener("resize", follow, { passive: true });
}
