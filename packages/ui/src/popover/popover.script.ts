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
  node instanceof HTMLElement && node.matches("[popover][data-side][role=dialog]");

/** The buttons that open or toggle the popover. */
const triggers = (popup: HTMLElement) =>
  document.querySelectorAll<HTMLElement>(
    `[popovertarget="${CSS.escape(popup.id)}"]:not([popovertargetaction=hide])`,
  );

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
// dismisses. A key press on the trigger clicks it too.
on("click", (event) => {
  const trigger = (event.target as Element).closest?.<HTMLElement>("[popovertarget]");
  const popup = trigger && document.getElementById(trigger.getAttribute("popovertarget")!);
  if (isPopover(popup) && !popup.matches(":popover-open")) popup.popover = "manual";
});

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
    if (popup.contains(document.activeElement)) return;
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
  const active = document.activeElement;
  if (active && active !== document.body && !popup.contains(active)) return;
  anchor(popup)?.focus({ preventScroll: true });
  openers.delete(popup);
});

if (!anchoring) {
  addEventListener("scroll", follow, { capture: true, passive: true });
  addEventListener("resize", follow, { passive: true });
}
