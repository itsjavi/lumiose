// Open-on-hover timing, shared by Popover's hover triggers (TASK-394) and Preview Card (TASK-381):
// a mouse or a pen resting on a trigger opens its popup after the trigger's `data-delay`, never
// touch; the popup stays open while the pointer is on the trigger or on it (WCAG 1.4.13:
// hoverable), and closes `data-close-delay` after the pointer left both, with at least a short
// grace to cross the gap between them. A press before the delay cancels the opening. Each
// client script calls `hoverIntent` once with how its triggers and popups are found and shown.
// It must not import `lumiose`: server-rendered pages load it without the runtime.

/** How long a hover-opened popup waits for the pointer to cross the gap from its trigger. */
const GRACE = 100;

/** A kind of hover trigger: how a script finds its triggers and popups and shows them. */
export interface HoverSource {
  /** The trigger at or around `node`, if it is one of this kind. */
  triggerAt(node: Element): HTMLElement | undefined;
  /** The popup `trigger` opens. */
  popupOf(trigger: HTMLElement): HTMLElement | undefined;
  /** Shows `popup` for `trigger`. */
  show(trigger: HTMLElement, popup: HTMLElement): void;
  /** Hides `popup`, unless something else (focus) keeps it open. */
  hide(popup: HTMLElement, trigger: HTMLElement): void;
  /** The delays when the trigger has no `data-delay` or `data-close-delay`, in ms. */
  delay: number;
  closeDelay: number;
}

export interface HoverIntent {
  /** The open popups the hover (or `open`) opened, with their trigger, until `forget`. */
  hovered: Map<HTMLElement, HTMLElement>;
  /** Opens `trigger`'s popup after its delay (also used for keyboard focus). */
  open(trigger: HTMLElement): void;
  /** Closes `popup` after its trigger's close delay, unless the pointer comes back. */
  close(popup: HTMLElement): void;
  /** Cancels a pending close of `popup`. */
  stay(popup: HTMLElement): void;
  /** Cancels a pending opening. */
  cancel(): void;
  /** Stops treating `popup` as hover-opened: it no longer closes when the pointer leaves. */
  forget(popup: HTMLElement): void;
}

const ms = (trigger: HTMLElement, name: string, fallback: number) => {
  const value = Number(trigger.getAttribute(name) ?? Number.NaN);
  return Number.isFinite(value) ? value : fallback;
};

const on = <K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
) => document.addEventListener(type, listener, true);

export function hoverIntent(source: HoverSource): HoverIntent {
  const hovered = new Map<HTMLElement, HTMLElement>();
  let opening: { trigger: HTMLElement; timer: ReturnType<typeof setTimeout> } | undefined;
  const closing = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

  const stay = (popup: HTMLElement) => {
    clearTimeout(closing.get(popup));
    closing.delete(popup);
  };
  const cancel = () => {
    clearTimeout(opening?.timer);
    opening = undefined;
  };
  const open = (trigger: HTMLElement) => {
    const popup = source.popupOf(trigger);
    if (!popup) return;
    if (popup.matches(":popover-open")) {
      stay(popup);
      return;
    }
    if (opening?.trigger === trigger) return;
    cancel();
    opening = {
      trigger,
      timer: setTimeout(
        () => {
          opening = undefined;
          if (popup.matches(":popover-open")) return;
          // Before it opens: the script's `toggle` handler may look it up.
          hovered.set(popup, trigger);
          source.show(trigger, popup);
        },
        ms(trigger, "data-delay", source.delay),
      ),
    };
  };
  const close = (popup: HTMLElement) => {
    const trigger = hovered.get(popup);
    if (!trigger) return;
    stay(popup);
    const delay = Math.max(ms(trigger, "data-close-delay", source.closeDelay), GRACE);
    closing.set(
      popup,
      setTimeout(() => {
        closing.delete(popup);
        if (hovered.has(popup) && popup.matches(":popover-open")) source.hide(popup, trigger);
      }, delay),
    );
  };

  on("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const target = event.target as Element;
    // Back on a hover-opened popup or its trigger: it stays open.
    for (const [popup, trigger] of hovered) {
      if (popup.contains(target) || trigger.contains(target)) stay(popup);
    }
    const trigger = source.triggerAt(target);
    if (trigger && !(trigger as HTMLButtonElement).disabled) open(trigger);
  });

  on("pointerout", (event) => {
    if (event.pointerType === "touch") return;
    const from = event.target as Node;
    const to = event.relatedTarget as Node | null;
    if (opening?.trigger.contains(from) && !opening.trigger.contains(to)) cancel();
    for (const [popup, trigger] of hovered) {
      const inside = (node: Node | null) =>
        !!node && (popup.contains(node) || trigger.contains(node));
      if (inside(from) && !inside(to)) close(popup);
    }
  });

  // A press before the delay cancels the opening (a click acts as it would without hover).
  on("pointerdown", cancel);

  return {
    hovered,
    open,
    close,
    stay,
    cancel,
    forget: (popup) => {
      stay(popup);
      hovered.delete(popup);
    },
  };
}
