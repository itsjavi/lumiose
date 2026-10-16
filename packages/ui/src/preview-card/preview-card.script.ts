// Preview Card's client script (decision-62, decision-63): it opens and closes every Preview Card
// on the page. A trigger is a link with `data-preview-card` naming its popup, a manual popover
// placed next to it by CSS anchor positioning (placement.css). Without the script the link is
// just a link: the card is an enhancement, as Base UI says its content should be.
//
// - Hover, with Popover's timing (../popover/hover.ts): a mouse or a pen resting on the link opens
//   the card after `data-delay` (600 ms); it stays while the pointer is on the link or the card,
//   and closes `data-close-delay` (300 ms) after it left both (WCAG 1.4.13: hoverable,
//   persistent). Never on touch: a tap follows the link.
// - Keyboard focus (`:focus-visible`) on the link opens it after the same delay, without moving
//   focus; it closes when focus leaves the link and the card. The open card follows its link in
//   the focus order (the link is its invoker), so Tab reaches the card's links. A card that closes
//   with focus inside (Escape) gives focus back to its link.
// - Dismissal by the shared layer model (../layer/layer.ts): Escape, without moving the pointer
//   (1.4.13: dismissible), and a press outside.
// - Placement where CSS anchor positioning is missing (../placement/place.ts).
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.
import { openLayer } from "../layer/layer.ts";
import { anchoring, place } from "../placement/place.ts";
import { hoverIntent } from "../popover/hover.ts";

const TRIGGER = "a[data-preview-card]";

/** Stops dismissing each open card (layer/layer.ts). */
const layers = new Map<HTMLElement, () => void>();
/** The cards that held focus as they started to close: focus goes back to their link. */
const holding = new WeakSet<HTMLElement>();
/** A link focus returns to: that focus does not open its card again. */
let returning: HTMLElement | undefined;

const popupOf = (trigger: HTMLElement) => {
  const popup = document.getElementById(trigger.dataset.previewCard ?? "");
  return popup?.hasAttribute("popover") ? popup : undefined;
};

/** Whether focus is on `trigger` from the keyboard, or inside `popup`: it keeps the card open. */
const focusKeeps = (popup: HTMLElement, trigger: HTMLElement) =>
  trigger.matches(":focus-visible") || popup.contains(document.activeElement);

function release(popup: HTMLElement) {
  layers.get(popup)?.();
  layers.delete(popup);
}

const hover = hoverIntent({
  triggerAt: (node) => node.closest?.<HTMLElement>(TRIGGER) ?? undefined,
  popupOf,
  show: (trigger, popup) => {
    (popup.showPopover as (options?: { source?: HTMLElement }) => void)({ source: trigger });
    if (!anchoring) place(popup, trigger);
  },
  hide: (popup, trigger) => {
    if (!focusKeeps(popup, trigger)) popup.hidePopover();
  },
  delay: 600,
  closeDelay: 300,
});

const on = <K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
) => document.addEventListener(type, listener, true);

on("focusin", (event) => {
  const target = event.target as Element;
  const trigger = target.closest?.<HTMLElement>(TRIGGER);
  if (trigger && trigger === returning) returning = undefined;
  else if (trigger && target.matches(":focus-visible")) hover.open(trigger);
  // Into an open card: it stays.
  for (const [popup] of hover.hovered) if (popup.contains(target)) hover.stay(popup);
});

on("focusout", (event) => {
  const from = event.target as Node;
  const to = event.relatedTarget as Node | null;
  for (const [popup, trigger] of hover.hovered) {
    const inside = (node: Node | null) =>
      !!node && (popup.contains(node) || trigger.contains(node));
    if (inside(from) && !inside(to)) {
      // Focus left: close, unless the pointer is still on the link or the card.
      if (trigger.matches(":hover") || popup.matches(":hover")) continue;
      popup.hidePopover();
    }
  }
  if (from instanceof Element && from.closest?.(TRIGGER)) hover.cancel();
});

on("beforetoggle", (event) => {
  const popup = event.target;
  if (!(popup instanceof HTMLElement) || !popup.matches("[popover][data-preview-card-popup]")) {
    return;
  }
  release(popup);
  if (event.newState !== "open") {
    if (popup.contains(document.activeElement)) holding.add(popup);
    return;
  }
  const trigger = document.querySelector<HTMLElement>(
    `${TRIGGER}[data-preview-card="${CSS.escape(popup.id)}"]`,
  );
  layers.set(
    popup,
    openLayer({
      popup,
      contains: (node) => popup.contains(node) || !!trigger?.contains(node),
      dismiss: () => popup.hidePopover(),
    }),
  );
  // Opened by the `open` prop: it is hover-opened from then on, so leaving it closes it.
  if (trigger && !hover.hovered.has(popup)) hover.hovered.set(popup, trigger);
  if (!anchoring && trigger) requestAnimationFrame(() => place(popup, trigger));
});

on("toggle", (event) => {
  const popup = event.target;
  if (!(popup instanceof HTMLElement) || !popup.matches("[popover][data-preview-card-popup]")) {
    return;
  }
  if (event.newState === "closed") hover.forget(popup);
  const trigger = document.querySelector<HTMLElement>(
    `${TRIGGER}[data-preview-card="${CSS.escape(popup.id)}"]`,
  );
  trigger?.toggleAttribute("data-popup-open", event.newState === "open");
  // Closed with focus inside (Escape, the `open` prop): the browser drops it to the page; back to
  // the link instead (TASK-434). Focus that moved on elsewhere stays there.
  if (event.newState === "closed" && holding.has(popup)) {
    holding.delete(popup);
    const active = document.activeElement;
    if (trigger && (!active || active === document.body || popup.contains(active))) {
      returning = trigger;
      trigger.focus({ preventScroll: true });
      returning = undefined;
    }
  }
});
