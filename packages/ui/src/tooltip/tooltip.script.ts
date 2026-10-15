// Tooltip's client script (decision-62, decision-63): what opens and closes a tooltip, for every
// Tooltip on the page. A trigger is an element whose `aria-describedby` names a
// `[popover][role=tooltip]`; the innermost one under the pointer wins. It follows Base UI and Zag
// (doc-9, section 4):
//
// - Opens after the trigger's `data-delay` (600 ms) of hover by a mouse or pen, never by touch, or
//   at once on keyboard focus (`:focus-visible`). Within 400 ms of another tooltip, it opens at
//   once. Only one tooltip is open at a time.
// - A press before the delay cancels it. Closes on Escape (only the tooltip: the keydown is
//   cancelled, so a dialog around it stays open), on a press, on a click of its trigger (unless
//   `data-close-on-click="false"`), on blur, and when an ancestor of the trigger scrolls.
// - Hoverable (WCAG 1.4.13): it stays open while the pointer moves onto it, unless the popup has
//   `data-disable-hoverable-popup`, and closes `data-close-delay` (0 ms) after the pointer leaves.
// - Placement where CSS anchor positioning is missing (placement/place.ts).
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.
import { anchoring, place } from "../placement/place.ts";

/** After a tooltip closes, how long the next one opens without delay (Base UI's Provider). */
const GROUP = 400;
/** How long a hoverable tooltip waits for the pointer to cross the gap from its trigger. */
const GRACE = 100;

let current: { trigger: HTMLElement; popup: HTMLElement } | undefined;
let pending: { trigger: HTMLElement; timer: ReturnType<typeof setTimeout> } | undefined;
let closing: ReturnType<typeof setTimeout> | undefined;
let closedAt = Number.NEGATIVE_INFINITY;
/** A trigger whose tooltip a click closed: it stays closed until the pointer or focus leaves. */
let suppressed: HTMLElement | undefined;

function on<K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
  options: AddEventListenerOptions = {},
) {
  document.addEventListener(type, listener, { capture: true, ...options });
}

/** The tooltip that describes `trigger`, if any. */
function tipOf(trigger: Element): HTMLElement | undefined {
  for (const id of (trigger.getAttribute("aria-describedby") ?? "").split(/\s+/)) {
    const tip = id ? document.getElementById(id) : null;
    if (tip?.matches("[popover][role=tooltip]")) return tip;
  }
  return undefined;
}

/** The innermost tooltip trigger at or around `node`. */
function triggerAt(node: EventTarget | null): HTMLElement | undefined {
  let element = node instanceof Element ? node.closest("[aria-describedby]") : null;
  while (element) {
    if (element instanceof HTMLElement && tipOf(element)) return element;
    element = element.parentElement?.closest("[aria-describedby]") ?? null;
  }
  return undefined;
}

const ms = (trigger: HTMLElement, name: string, fallback: number) => {
  const value = Number(trigger.getAttribute(name) ?? Number.NaN);
  return Number.isFinite(value) ? value : fallback;
};

const hoverable = (popup: HTMLElement) => !popup.hasAttribute("data-disable-hoverable-popup");

function cancel() {
  clearTimeout(pending?.timer);
  clearTimeout(closing);
  pending = undefined;
  closing = undefined;
}

function show(trigger: HTMLElement) {
  cancel();
  const popup = tipOf(trigger);
  if (!popup) return;
  if (current && current.popup !== popup) hide();
  current = { trigger, popup };
  if (!popup.matches(":popover-open")) {
    // `source` makes the trigger the tooltip's invoker: a tooltip inside a popover keeps it open.
    (popup.showPopover as (options?: { source?: HTMLElement }) => void)({ source: trigger });
  }
  if (!anchoring) place(popup, trigger);
}

function hide() {
  cancel();
  const popup = current?.popup;
  current = undefined;
  closedAt = performance.now();
  if (popup?.matches(":popover-open")) popup.hidePopover();
}

/** Opens `trigger`'s tooltip after its delay, or at once within the group window. */
function schedule(trigger: HTMLElement) {
  if (trigger.hasAttribute("data-trigger-disabled") || trigger === suppressed) return;
  if (current?.trigger === trigger) {
    clearTimeout(closing);
    return;
  }
  if (pending?.trigger === trigger) return;
  clearTimeout(pending?.timer);
  const warm = current !== undefined || performance.now() - closedAt < GROUP;
  const delay = warm ? 0 : ms(trigger, "data-delay", 600);
  if (delay === 0) show(trigger);
  else pending = { trigger, timer: setTimeout(() => show(trigger), delay) };
}

on("pointerover", (event) => {
  if (event.pointerType === "touch") return;
  const target = event.target as Node;
  if (current && hoverable(current.popup) && current.popup.contains(target)) {
    clearTimeout(closing);
    return;
  }
  const trigger = triggerAt(target);
  if (trigger) schedule(trigger);
});

on("pointerout", (event) => {
  if (event.pointerType === "touch") return;
  const from = event.target as Node;
  const to = event.relatedTarget as Node | null;
  const left = (element: HTMLElement) => element.contains(from) && !element.contains(to);
  if (pending && left(pending.trigger)) cancel();
  if (suppressed && left(suppressed)) suppressed = undefined;
  if (!current) return;
  const { trigger, popup } = current;
  const inside = (node: Node | null) =>
    trigger.contains(node) || (hoverable(popup) && popup.contains(node));
  if (inside(from) && !inside(to)) {
    clearTimeout(closing);
    const delay = ms(trigger, "data-close-delay", 0);
    closing = setTimeout(hide, hoverable(popup) ? Math.max(delay, GRACE) : delay);
  }
});

on("pointerdown", (event) => {
  const target = event.target as Node;
  clearTimeout(pending?.timer);
  pending = undefined;
  if (!current || current.popup.contains(target)) return;
  const { trigger } = current;
  if (trigger.contains(target)) {
    if (trigger.getAttribute("data-close-on-click") === "false") return;
    suppressed = trigger;
  }
  hide();
});

// A click on the trigger, from the keyboard (Enter or Space) too.
on("click", (event) => {
  if (!current || !current.trigger.contains(event.target as Node)) return;
  if (current.trigger.getAttribute("data-close-on-click") === "false") {
    // The browser light-dismisses a hint on a press outside it, its trigger included: undo it.
    if (!current.popup.matches(":popover-open")) show(current.trigger);
    return;
  }
  suppressed = current.trigger;
  hide();
});

on("focusin", (event) => {
  const target = event.target as HTMLElement;
  const trigger = triggerAt(target);
  if (!trigger || trigger.hasAttribute("data-trigger-disabled")) return;
  if (target.matches(":focus-visible")) show(trigger);
});

on("focusout", (event) => {
  const target = event.target as Node;
  const to = event.relatedTarget as Node | null;
  if (suppressed?.contains(target) && !suppressed.contains(to)) suppressed = undefined;
  if (current?.trigger.contains(target) && !current.trigger.contains(to)) hide();
});

on("keydown", (event) => {
  if (event.key !== "Escape" || !current?.popup.matches(":popover-open")) return;
  // Only the tooltip closes: a cancelled keydown is no close request for a dialog around it.
  event.preventDefault();
  hide();
});

on(
  "scroll",
  (event) => {
    const scroller = event.target;
    if (current && scroller instanceof Node && scroller.contains(current.trigger)) hide();
  },
  { passive: true },
);

// Opened or closed another way: the `open` prop, or the browser's light dismiss of a hint.
on("toggle", (event) => {
  const popup = event.target;
  if (!(popup instanceof HTMLElement) || !popup.matches("[popover][role=tooltip]")) return;
  if (event.newState === "closed") {
    if (current?.popup === popup) {
      current = undefined;
      closedAt = performance.now();
    }
    return;
  }
  if (current?.popup === popup) return;
  const trigger = document.querySelector<HTMLElement>(
    `[aria-describedby~="${CSS.escape(popup.id)}"]`,
  );
  if (!trigger) return;
  if (current) hide();
  current = { trigger, popup };
  if (!anchoring) place(popup, trigger);
});

// Opened by the `open` prop: placed in the frame it first paints in.
on("beforetoggle", (event) => {
  const popup = event.target;
  if (anchoring || event.newState !== "open" || !(popup instanceof HTMLElement)) return;
  if (!popup.matches("[popover][role=tooltip]")) return;
  requestAnimationFrame(() => {
    const trigger = current?.popup === popup ? current.trigger : undefined;
    if (trigger && popup.matches(":popover-open")) place(popup, trigger);
  });
});
