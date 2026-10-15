// The dismissal model of the anchored layers that @lumiose/ui's client scripts open: Menu, Popover
// and Combobox (doc-9 section 1, TASK-396). A layer is a manual popover (`popover="manual"`) that
// its script shows and that this module closes, in one way for all of them:
//
// - On an outside press: a press of the main button by the primary pointer whose press and release
//   both land outside the layer, as in Base UI and Zag. A press on a scrollbar, on a node the press
//   removed, or inside the popup's box (a password manager's overlay) is not outside. Native light
//   dismiss would also close on a right-click or a second finger, and cannot be cancelled: that is
//   why the scripts make their popups manual instead of leaving dismissal to `popover="auto"`.
// - On a close request: an Escape that no handler took (`preventDefault`), or the Android back
//   gesture, through a `CloseWatcher` per layer where the browser has one, else an Escape listener.
//   One request closes the topmost layer only.
// - When another layer opens outside it, as the auto popover stack does: opening a layer closes the
//   open layers it is not inside of. Layers nest through the DOM (a submenu inside its menu's
//   popup, a combobox inside a popover).
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
  const box = layer.popup.getBoundingClientRect();
  return !(x >= box.left && x <= box.right && y >= box.top && y <= box.bottom);
}

/** Whether a press is on a scrollbar of `target`: past its client box. */
function onScrollbar(target: Element, event: PointerEvent): boolean {
  const { clientWidth: width, clientHeight: height } = target;
  return width > 0 && height > 0 && (event.offsetX > width || event.offsetY > height);
}

function onPointerDown(event: PointerEvent) {
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
  if (typeof CloseWatcher !== "function") document.addEventListener("keydown", onKeyDown);
}

/**
 * Starts dismissing `layer`, whose popup has just opened, and closes the open layers it is not
 * inside of. Call the returned function when it closes, whatever closed it.
 */
export function openLayer(layer: Layer): () => void {
  for (const entry of stack.toReversed()) {
    if (stack.includes(entry) && !entry.layer.contains(layer.popup)) entry.layer.dismiss();
  }
  const entry: Entry = { layer };
  if (typeof CloseWatcher === "function") {
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
  };
}
