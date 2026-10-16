// The dismissal model of the anchored layers that @lumiose/ui's client scripts open: Menu, Popover
// and Combobox (doc-9 section 1, TASK-396). A layer is a manual popover (`popover="manual"`) that
// its script shows and that this module closes, in one way for all of them:
//
// - On an outside press: a press of the main button by the primary pointer whose press and release
//   both land outside the layer, as in Base UI and Zag. A press on a scrollbar, on a node the press
//   removed, inside the popup's box (a password manager's overlay) or in a toast is not outside.
//   Native light dismiss would also close on a right-click or a second finger, and cannot be
//   cancelled: that is why the scripts make their popups manual instead of leaving dismissal to
//   `popover="auto"`.
// - On a close request: an Escape that no handler took (`preventDefault`), or the Android back
//   gesture. One request closes the topmost layer only. Escape is handled on `keydown` in every
//   browser (and cancelled, so no native close request follows): a `CloseWatcher` created without
//   user activation joins the previous one's group, and one close request would close the whole
//   group, a hover-opened popover and the dialog it is in, say (TASK-427). A layer opened with user
//   activation also gets a `CloseWatcher`, for the Android back gesture.
// - When another layer opens outside it, as the auto popover stack does: opening a layer closes the
//   open layers it is not inside of. Layers nest through the DOM (a submenu inside its menu's
//   popup, a combobox inside a popover).
// - With it: a layer that closes, whatever closed it (a bound `open` set to false), closes the
//   popovers and dialogs open inside it, innermost first (TASK-436 M1).
//
// Server HTML keeps `popover="auto"` where a popup should open without JavaScript (Menu, Popover):
// native light dismiss and Escape work there until a script takes the popup over.
// It must not import `lumiose`: server-rendered pages load it without the runtime.

export interface Layer {
  /** The popup, open while the layer is. */
  popup: HTMLElement;
  /** Whether `node` is part of the layer: its popup, and what opens it (its trigger, its input). */
  contains(node: Node): boolean;
  /** Closes the layer, after an outside press (`press` is where it landed) or a close request. */
  dismiss(press?: Element): void;
}

/** Chrome 126 and Firefox 149; not in TypeScript's DOM types yet. */
declare const CloseWatcher: (new () => EventTarget & { destroy(): void }) | undefined;

interface Entry {
  layer: Layer;
  watcher?: { destroy(): void };
}

/** The open layers, outermost first. */
const stack: Entry[] = [];
/** The last press while a layer was open, and whether it counts for an outside press. */
let press: { target: Element; main: boolean; x: number; y: number } | undefined;

/** Whether a press at `x`, `y` on `node` is outside `layer`. */
function outside({ layer }: Entry, node: Element, x: number, y: number): boolean {
  if (!node.isConnected || layer.contains(node)) return false;
  // Toasts persist: a press in one leaves the open layers alone (TASK-371).
  if (node.closest("lu-toast-viewport")) return false;
  const box = layer.popup.getBoundingClientRect();
  const empty = box.width === 0 && box.height === 0;
  return empty || !(x >= box.left && x <= box.right && y >= box.top && y <= box.bottom);
}

/** Whether a press is on a scrollbar of `target`: past its client box. */
function onScrollbar(target: Element, event: PointerEvent): boolean {
  const { clientWidth: width, clientHeight: height } = target;
  return width > 0 && height > 0 && (event.offsetX > width || event.offsetY > height);
}

/**
 * Forgets the layers whose popup left the page while open: removing a popover hides it without
 * events, so its script never released it.
 */
function prune() {
  for (const entry of stack.toReversed()) {
    if (!entry.layer.popup.isConnected) {
      stack.splice(stack.indexOf(entry), 1);
      entry.watcher?.destroy();
    }
  }
}

function onPointerDown(event: PointerEvent) {
  prune();
  if (stack.length === 0) return;
  const target = event.target as Element;
  press = {
    target,
    main: event.button === 0 && event.isPrimary && !onScrollbar(target, event),
    x: event.clientX,
    y: event.clientY,
  };
}

function onPointerUp(event: PointerEvent) {
  const pressed = press;
  press = undefined;
  if (!pressed?.main) return;
  const target = event.target as Element;
  // Innermost first: closing a layer may close the layers inside it.
  for (const entry of stack.toReversed()) {
    if (
      stack.includes(entry) &&
      outside(entry, pressed.target, pressed.x, pressed.y) &&
      outside(entry, target, event.clientX, event.clientY)
    ) {
      entry.layer.dismiss(target);
    }
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
  const top = stack.at(-1);
  if (!top) return;
  // Handled: a parent dialog keeps its own close request for the next Escape.
  event.preventDefault();
  top.layer.dismiss();
}

if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointerup", onPointerUp, true);
  // Before the close request an Escape makes, so a removed layer's watcher does not take it.
  document.addEventListener("keydown", prune, true);
  // In the bubble phase, after a layer's own handlers (Menu's, Tooltip's), which cancel the key.
  document.addEventListener("keydown", onKeyDown);
}

/** Whether the page has transient user activation (a click, a key) to give a CloseWatcher. */
const activated = () =>
  (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation?.isActive ===
  true;

/**
 * Starts dismissing `layer`, whose popup opens, and closes the open layers it is not inside of.
 * Call the returned function when it closes, whatever closed it.
 */
export function openLayer(layer: Layer): () => void {
  prune();
  for (const entry of stack.toReversed()) {
    if (stack.includes(entry) && !entry.layer.contains(layer.popup)) entry.layer.dismiss();
  }
  const entry: Entry = { layer };
  // Without activation, a watcher would join the group of the one before (see above).
  if (typeof CloseWatcher === "function" && activated()) {
    const watcher = new CloseWatcher();
    watcher.addEventListener("close", () => layer.dismiss());
    entry.watcher = watcher;
  }
  stack.push(entry);
  return () => {
    const index = stack.indexOf(entry);
    if (index === -1) return;
    stack.splice(index, 1);
    // Now, not a task later: the next close request belongs to the layer below.
    entry.watcher?.destroy();
    closeInside(layer.popup);
  };
}

/**
 * Closes the popovers and dialogs open inside `popup`, innermost first: they must not outlive it
 * (a modal dialog left open in a hidden popover has no box, and takes every click). Toasts, whose
 * region may sit in a dialog, stay.
 */
export function closeInside(popup: HTMLElement): void {
  const open = [...popup.querySelectorAll<HTMLElement>(":popover-open, dialog[open]")];
  for (const each of open.toReversed()) {
    if (each.localName === "lu-toast-viewport" || each.closest("lu-toast-viewport")) continue;
    if (each instanceof HTMLDialogElement) each.close();
    else if (each.matches(":popover-open")) each.hidePopover();
  }
}

// Pointer moves that are not movements (doc-9 section 1, TASK-361): when the keyboard scrolls a
// layer's list under a resting pointer, WebKit fires moves at the same position (with zero deltas),
// and the list must not highlight what passes under it. The position tells, not the deltas: some
// engines send none (Playwright's WebKit reports `movementX` and `movementY` as 0 for every move).

/** The last position seen per element. */
const last = new WeakMap<object, { x: number; y: number }>();

/** Whether `event` moved the pointer since the last move `owner` saw (touch never counts). */
export function moved(owner: object, event: PointerEvent): boolean {
  if (event.pointerType === "touch") return false;
  const before = last.get(owner);
  last.set(owner, { x: event.clientX, y: event.clientY });
  return before === undefined || before.x !== event.clientX || before.y !== event.clientY;
}
