// Dialog's client script (decision-62's "native gaps are closed by small scripts", shipped through
// the client-script import of decision-63). Dialog works without it; on a page that renders one,
// this module runs once and closes what a native modal <dialog> misses next to Base UI and Zag
// (doc-9), for every <dialog> on the page:
//
// - Light dismiss: a secondary button or a second finger outside does not close a dialog, and
//   `closedby="any"` works where the browser lacks it (Safari).
// - Invoker commands (`show-modal`, `close`, `request-close`) where the browser lacks them.
// - Nesting: a dialog with open dialogs inside gets `data-nested-dialog-open` and `--lu-nested-dialogs`.
// - Touch: a dialog opened by touch focuses itself rather than its first field, so no virtual
//   keyboard opens (an `autofocus` element still gets focus).
// - Focus return: when closing leaves focus nowhere (WebKit does not focus a clicked trigger, or the
//   trigger is gone), focus goes to the opener, else to a trigger of the dialog, without scrolling.
// - Scroll lock (dialog.css locks <html> and keeps its scrollbar's gutter): a <body> that scrolls is
//   locked too, and a page without a scrollbar gets no empty gutter.
// - A dialog that closes closes the popovers and dialogs open inside it, innermost first, so none
//   outlives it (TASK-436 M1; Chromium would keep a popover showing without its dialog).
// - One Escape closes one layer (TASK-427): an Escape that nothing above took closes the topmost
//   modal dialog through `requestClose()` (not one with `closedby="none"`), and is cancelled, so
//   the browser's own close request does not follow. A dialog opened without user activation
//   (by a timer) shares a close-watcher group with the dialog or popover before it, and that
//   request would close the whole group.
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.

/** The last press, until a key is pressed: what a `cancel` or a `click` came from. */
let press: PointerEvent | undefined;
/** A dialog opening after a touch: its first focus moves to the dialog itself. */
let touched: HTMLDialogElement | undefined;
const openers = new WeakMap<HTMLDialogElement, HTMLElement>();
/** Undoes the scroll lock's inline styles once no modal dialog is open. */
let unlock: (() => void) | undefined;
/** The open modal dialogs, in the order they opened: the last is on top. */
const modals: HTMLDialogElement[] = [];

function on<K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
) {
  document.addEventListener(type, listener, true);
}

const isDialog = (node: unknown): node is HTMLDialogElement => node instanceof HTMLDialogElement;
const recent = (event: Event) => press !== undefined && event.timeStamp - press.timeStamp < 1000;
const primary = (event: PointerEvent) => event.button === 0 && event.isPrimary;

/** Runs before a dialog opens, while the page can still be measured unlocked. */
function lockScroll() {
  if (unlock) return;
  const { documentElement: html, body } = document;
  const { scrollbarGutter } = html.style;
  const { overflowY } = body.style;
  if (getComputedStyle(html).scrollbarGutter === "auto" && html.scrollHeight <= html.clientHeight) {
    html.style.scrollbarGutter = "auto";
  }
  if (
    /auto|scroll/.test(getComputedStyle(body).overflowY) &&
    body.scrollHeight > body.clientHeight
  ) {
    body.style.overflowY = "hidden";
  }
  unlock = () => {
    html.style.scrollbarGutter = scrollbarGutter;
    body.style.overflowY = overflowY;
    unlock = undefined;
  };
}

/** Whether a press is outside the dialog's box, on its backdrop. */
function outside(dialog: HTMLDialogElement, { clientX: x, clientY: y }: MouseEvent): boolean {
  const box = dialog.getBoundingClientRect();
  return x < box.left || x > box.right || y < box.top || y > box.bottom;
}

on("pointerdown", (event) => (press = event));
on("keydown", () => (press = undefined));

// Native light dismiss fires a cancelable `cancel`: keep the dialog open for other presses.
on("cancel", (event) => {
  if (recent(event) && !primary(press!)) event.preventDefault();
});

if (!("closedBy" in HTMLDialogElement.prototype)) {
  on("click", (event) => {
    const dialog = event.target;
    if (
      isDialog(dialog) &&
      dialog.matches("[open][closedby=any]") &&
      press?.target === dialog &&
      primary(press) &&
      outside(dialog, press) &&
      outside(dialog, event)
    ) {
      if (dialog.requestClose) dialog.requestClose();
      else dialog.close();
    }
  });
}

if (!("command" in HTMLButtonElement.prototype)) {
  on("click", (event) => {
    const button = (event.target as Element).closest?.<HTMLButtonElement>("button[commandfor]");
    const dialog = button && document.getElementById(button.getAttribute("commandfor")!);
    if (!isDialog(dialog)) return;
    const command = button!.getAttribute("command");
    if (command === "show-modal" && !dialog.open) {
      openers.set(dialog, button!);
      dialog.showModal();
    } else if (command === "close" && dialog.open) {
      dialog.close(button!.value);
    } else if (command === "request-close" && dialog.open) {
      if (dialog.requestClose) dialog.requestClose(button!.value);
      else dialog.close(button!.value);
    }
  });
}

on("command", (event) => {
  // A CommandEvent: `source` is the invoker.
  const { command, source } = event as Event & { command: string; source: Element | null };
  if (isDialog(event.target) && command === "show-modal" && source instanceof HTMLElement) {
    openers.set(event.target, source);
  }
});

on("beforetoggle", (event) => {
  const dialog = event.target;
  if (!isDialog(dialog) || event.newState !== "open") return;
  const active = document.activeElement;
  if (!openers.has(dialog) && active instanceof HTMLElement && active !== document.body) {
    openers.set(dialog, active);
  }
  if (recent(event) && press!.pointerType === "touch") touched = dialog;
  lockScroll();
});

// Opening focuses the first focusable element synchronously, between `beforetoggle` and `toggle`.
on("focusin", (event) => {
  const dialog = touched;
  const target = event.target as Element;
  if (!dialog?.contains(target) || target === dialog) return;
  touched = undefined;
  if (target.hasAttribute("autofocus")) return;
  if (!dialog.hasAttribute("tabindex")) dialog.tabIndex = -1;
  dialog.focus({ preventScroll: true });
});

/**
 * Whether a native popup is open above `dialog`: a select's picker, or a popover that no layer
 * script runs (the toast viewport, always open, aside). The browser's close request is its.
 */
function popupAbove(dialog: HTMLDialogElement): boolean {
  const popovers = [...document.querySelectorAll(":popover-open")].filter(
    (popover) => popover.localName !== "lu-toast-viewport" && !popover.contains(dialog),
  );
  if (popovers.length > 0) return true;
  try {
    return dialog.querySelector("select:open") !== null;
  } catch {
    // No `:open` (Firefox): no customizable select picker either.
    return false;
  }
}

// On `window`, after the layers' listeners on `document`: an open layer takes the Escape first.
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
  const dialog = modals.filter((each) => each.isConnected && each.matches(":modal")).at(-1);
  if (!dialog || popupAbove(dialog)) return;
  event.preventDefault();
  if (dialog.getAttribute("closedby") === "none") return;
  if (dialog.requestClose) dialog.requestClose();
  else if (dialog.dispatchEvent(new Event("cancel", { cancelable: true }))) dialog.close();
});

on("toggle", (event) => {
  const dialog = event.target;
  if (!isDialog(dialog)) return;
  touched = undefined;
  const at = modals.indexOf(dialog);
  if (at !== -1) modals.splice(at, 1);
  if (event.newState === "open" && dialog.matches(":modal")) modals.push(dialog);
  if (!document.querySelector("dialog:modal")) unlock?.();
  for (const each of document.querySelectorAll("dialog")) {
    const nested = each.querySelectorAll("dialog[open]").length;
    each.toggleAttribute("data-nested-dialog-open", nested > 0);
    if (nested) each.style.setProperty("--lu-nested-dialogs", String(nested));
    else each.style.removeProperty("--lu-nested-dialogs");
  }
  if (event.newState !== "closed") return;
  for (const each of [
    ...dialog.querySelectorAll<HTMLElement>(":popover-open, dialog[open]"),
  ].toReversed()) {
    if (each.closest("lu-toast-viewport")) continue;
    if (isDialog(each)) each.close();
    else if (each.matches(":popover-open")) each.hidePopover();
  }
  // The browser has already restored focus, or failed to: fix only the failure.
  const opener = openers.get(dialog);
  openers.delete(dialog);
  const active = document.activeElement;
  if (dialog.open || (active && active !== document.body && !dialog.contains(active))) return;
  const trigger = opener?.isConnected
    ? opener
    : document.querySelector<HTMLElement>(`[commandfor="${dialog.id}"][command="show-modal"]`);
  trigger?.focus({ preventScroll: true });
});

// A module, so it runs once per page whoever imports it.
// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
