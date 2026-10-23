// Popover's hover script (TASK-394, TASK-541): only a Popover.Trigger with `openOnHover` loads it,
// so a page without one goes without the hover timing (hover.ts). A trigger with
// `data-open-on-hover` opens its popover after `data-delay` of hover by a mouse or a pen, and the
// popover closes `data-close-delay` after the pointer left both (popover.script.ts, which this
// script hands the timing to, follows what it opened: focus, a click on the trigger).
// It must not import `lumiose`: server-rendered pages load it without the runtime.
import { hoverIntent } from "./hover.ts";
import { isPopover, useHover } from "./popover.script.ts";

useHover(
  hoverIntent({
    triggerAt: (node) =>
      node.closest?.<HTMLElement>("button[data-open-on-hover][popovertarget]") ?? undefined,
    popupOf: (trigger) => {
      const popup = document.getElementById(trigger.getAttribute("popovertarget")!);
      return isPopover(popup) ? popup : undefined;
    },
    show: (trigger, popup) => {
      // A hover-opened popover leaves focus where it is (popover.script.ts's `toggle`).
      popup.popover = "manual";
      (popup.showPopover as (options?: { source?: HTMLElement }) => void)({ source: trigger });
    },
    hide: (popup) => popup.hidePopover(),
    delay: 300,
    closeDelay: 0,
  }),
);
