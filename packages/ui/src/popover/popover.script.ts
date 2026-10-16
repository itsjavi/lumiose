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
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.
import { openLayer } from "../layer/layer.ts";
import { anchoring, place } from "../placement/place.ts";

/** The last press, until a key is pressed: what an opening came from. */
let press: PointerEvent | undefined;
const openers = new WeakMap<HTMLElement, HTMLElement>();
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
    stay(popup);
    hovered.delete(popup);
  }
});

// Open on hover --------------------------------------------------------------------------------

/** How long a hover-opened popover waits for the pointer to cross the gap from its trigger. */
const GRACE = 100;
/** The open popovers a hover opened, with their trigger, until a click keeps one open. */
const hovered = new Map<HTMLElement, HTMLElement>();
/** A hover waiting for its delay to open a popover. */
let opening: { trigger: HTMLElement; timer: ReturnType<typeof setTimeout> } | undefined;
/** Hover-opened popovers the pointer left, closing after their close delay. */
const closing = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

const ms = (trigger: HTMLElement, name: string, fallback: number) => {
  const value = Number(trigger.getAttribute(name) ?? Number.NaN);
  return Number.isFinite(value) ? value : fallback;
};

function stay(popup: HTMLElement) {
  clearTimeout(closing.get(popup));
  closing.delete(popup);
}

function cancelOpening() {
  clearTimeout(opening?.timer);
  opening = undefined;
}

on("pointerover", (event) => {
  if (event.pointerType === "touch") return;
  const target = event.target as Node;
  // Back on a hover-opened popover or its trigger: it stays open.
  for (const [popup, trigger] of hovered) {
    if (popup.contains(target) || trigger.contains(target)) stay(popup);
  }
  const trigger = (target as Element).closest?.<HTMLButtonElement>(
    "button[data-open-on-hover][popovertarget]",
  );
  if (!trigger || trigger.disabled || opening?.trigger === trigger) return;
  const popup = document.getElementById(trigger.getAttribute("popovertarget")!);
  if (!isPopover(popup) || popup.matches(":popover-open")) return;
  cancelOpening();
  opening = {
    trigger,
    timer: setTimeout(
      () => {
        opening = undefined;
        if (popup.matches(":popover-open")) return;
        // Before it opens: a hover-opened popover leaves focus where it is (see `toggle`).
        hovered.set(popup, trigger);
        popup.popover = "manual";
        (popup.showPopover as (options?: { source?: HTMLElement }) => void)({ source: trigger });
      },
      ms(trigger, "data-delay", 300),
    ),
  };
});

on("pointerout", (event) => {
  if (event.pointerType === "touch") return;
  const from = event.target as Node;
  const to = event.relatedTarget as Node | null;
  if (opening?.trigger.contains(from) && !opening.trigger.contains(to)) cancelOpening();
  for (const [popup, trigger] of hovered) {
    const inside = (node: Node | null) =>
      !!node && (popup.contains(node) || trigger.contains(node));
    if (!inside(from) || inside(to)) continue;
    stay(popup);
    const delay = Math.max(ms(trigger, "data-close-delay", 0), GRACE);
    closing.set(
      popup,
      setTimeout(() => {
        closing.delete(popup);
        if (hovered.has(popup) && popup.matches(":popover-open")) popup.hidePopover();
      }, delay),
    );
  }
});

// A press before the delay cancels the opening (the click opens it, as without hover).
on("pointerdown", cancelOpening);

/** Stops dismissing `popup`: as it closes, so the next close request goes to the layer below. */
function release(popup: HTMLElement) {
  layers.get(popup)?.();
  layers.delete(popup);
}

on("beforetoggle", (event) => {
  const popup = event.target;
  if (!isPopover(popup)) return;
  release(popup);
  if (event.newState === "closed") return;
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
    const first = touch
      ? undefined
      : [...popup.querySelectorAll<HTMLElement>(FOCUSABLE)].find((element) =>
          element.checkVisibility(),
        );
    if (first) first.focus();
    else {
      if (!popup.hasAttribute("tabindex")) popup.tabIndex = -1;
      popup.focus({ preventScroll: true });
    }
    return;
  }

  placed.delete(popup);
  hovered.delete(popup);
  stay(popup);
  const active = document.activeElement;
  if (active && active !== document.body && !popup.contains(active)) return;
  anchor(popup)?.focus({ preventScroll: true });
  openers.delete(popup);
});

if (!anchoring) {
  addEventListener("scroll", follow, { capture: true, passive: true });
  addEventListener("resize", follow, { passive: true });
}
