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
// - Light dismiss: a right-click or a second finger outside does not close a popover.
// - `aria-expanded` on the triggers, following the popover.
// - Placement where CSS anchor positioning is missing (placement/place.ts).
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.
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

/** Popovers a secondary press closed, to show again, outermost first. */
let reopen: { popup: HTMLElement; source?: HTMLElement }[] = [];

on("beforetoggle", (event) => {
  const popup = event.target;
  if (!isPopover(popup)) return;
  if (event.newState === "closed") {
    // A right-click or a second finger outside: Base UI and Zag ignore it, the browser's light
    // dismiss does not, and a popover's closing cannot be cancelled. Show it again before the
    // next frame, so it never disappears.
    const secondary = press && (press.button !== 0 || !press.isPrimary);
    if (
      secondary &&
      event.timeStamp - press!.timeStamp < 1000 &&
      !popup.contains(press!.target as Node)
    ) {
      if (reopen.length === 0) {
        requestAnimationFrame(() => {
          for (const closed of reopen.toReversed()) {
            if (closed.popup.isConnected && !closed.popup.matches(":popover-open")) {
              (closed.popup.showPopover as (options?: { source?: HTMLElement }) => void)({
                source: closed.source,
              });
            }
          }
          reopen = [];
        });
      }
      reopen.push({ popup, source: anchor(popup) });
    }
    return;
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
