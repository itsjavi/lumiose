// Drawer's client script (decision-62, decision-63). A drawer is a Dialog: a native modal
// `<dialog>` with `data-swipe-direction`, which drawer.css puts against that edge of the window,
// so it opens and closes, traps focus and makes the page inert in server HTML with no JavaScript,
// and Dialog's script closes the native element's gaps. This module, which runs once on a page
// that renders a Drawer, adds swiping it away in that direction, as Base UI's Drawer does:
//
// - A drag in the dismiss direction moves the drawer: `data-swiping` and
//   `--drawer-swipe-movement-x` or `-y` (pixels) while it runs, `--drawer-swipe-progress` (0 to 1)
//   for the backdrop. Against that direction it moves a little, as a hint.
// - Released past 40% of its size, or flicked (faster than 0.5px/ms over 20px), it closes, with
//   `data-swipe-dismiss` so a stylesheet can let it leave from where it is. Otherwise it springs
//   back.
// - A drag never starts on a control (a button, link or field) or inside `[data-swipe-ignore]`,
//   and not where the content under it can still scroll that way: the content scrolls instead.
//   On a touch screen it takes the gesture (`touchmove`'s `preventDefault`) only once it is a swipe.
// - The close buttons, Escape and a click on the backdrop close it without a gesture (WCAG 2.5.7).
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.
import { afterAnimations } from "../animation/animation.ts";

const CONTROLS = "button, a[href], input, select, textarea, [contenteditable], [data-swipe-ignore]";
/** Pixels a drag moves before it counts, and the share of the drawer's size that dismisses it. */
const SLOP = 6;
const DISMISS = 0.4;
const FLICK = 0.5;

type Direction = "up" | "down" | "left" | "right";

interface Drag {
  dialog: HTMLDialogElement;
  direction: Direction;
  x: number;
  y: number;
  /** Whether the drag became a swipe (it moved in the dismiss direction). */
  swiping: boolean;
  /** The last move's time and movement, for the flick. */
  at: number;
  movement: number;
  velocity: number;
}

let drag: Drag | undefined;

const axis = (direction: Direction) => (direction === "up" || direction === "down" ? "y" : "x");
const sign = (direction: Direction) => (direction === "down" || direction === "right" ? 1 : -1);

/** Whether an element between `target` and the dialog can scroll toward `direction`'s opposite. */
function scrolls(target: Element, dialog: HTMLDialogElement, direction: Direction): boolean {
  for (
    let node: Element | null = target;
    node && node !== dialog.parentElement;
    node = node.parentElement
  ) {
    const vertical = axis(direction) === "y";
    const size = vertical
      ? node.scrollHeight - node.clientHeight
      : node.scrollWidth - node.clientWidth;
    if (size <= 1) continue;
    const overflow = getComputedStyle(node)[vertical ? "overflowY" : "overflowX"];
    if (!/auto|scroll/.test(overflow)) continue;
    const position = vertical ? node.scrollTop : node.scrollLeft;
    // Swiping down dismisses only once the content is scrolled to its top, and so on.
    if (sign(direction) > 0 ? position > 0 : position < size - 1) return true;
  }
  return false;
}

function start(target: EventTarget | null, x: number, y: number): boolean {
  if (!(target instanceof Element)) return false;
  const dialog = target.closest<HTMLDialogElement>("dialog[data-swipe-direction]");
  if (!dialog?.open || target.closest(CONTROLS)) return false;
  const direction = dialog.dataset["swipeDirection"] as Direction;
  if (scrolls(target, dialog, direction)) return false;
  drag = {
    dialog,
    direction,
    x,
    y,
    swiping: false,
    at: performance.now(),
    movement: 0,
    velocity: 0,
  };
  return true;
}

/** Follows the pointer; returns whether the drag is a swipe (so a touch is not a scroll). */
function move(x: number, y: number): boolean {
  if (!drag) return false;
  const { dialog, direction } = drag;
  const delta = axis(direction) === "y" ? y - drag.y : x - drag.x;
  const toward = delta * sign(direction);
  if (!drag.swiping) {
    if (Math.abs(delta) < SLOP) return false;
    // A first move the other way, or along the other axis, is not a swipe.
    const across = axis(direction) === "y" ? Math.abs(x - drag.x) : Math.abs(y - drag.y);
    if (toward <= 0 || across > Math.abs(delta)) {
      drag = undefined;
      return false;
    }
    drag.swiping = true;
    dialog.setAttribute("data-swiping", "");
  }
  const now = performance.now();
  const movement = toward > 0 ? toward : toward / 8;
  drag.velocity = (movement - drag.movement) / Math.max(1, now - drag.at);
  drag.at = now;
  drag.movement = movement;
  const size = axis(direction) === "y" ? dialog.offsetHeight : dialog.offsetWidth;
  dialog.style.setProperty(
    `--drawer-swipe-movement-${axis(direction)}`,
    `${movement * sign(direction)}px`,
  );
  dialog.style.setProperty(
    "--drawer-swipe-progress",
    String(Math.min(1, Math.max(0, movement / size))),
  );
  return true;
}

function reset(dialog: HTMLDialogElement) {
  for (const name of [
    "--drawer-swipe-movement-x",
    "--drawer-swipe-movement-y",
    "--drawer-swipe-progress",
  ]) {
    dialog.style.removeProperty(name);
  }
}

function end(): void {
  const current = drag;
  drag = undefined;
  if (!current?.swiping) return;
  const { dialog, direction, movement, velocity } = current;
  dialog.removeAttribute("data-swiping");
  const size = axis(direction) === "y" ? dialog.offsetHeight : dialog.offsetWidth;
  if (movement > size * DISMISS || (velocity > FLICK && movement > 20)) {
    dialog.setAttribute("data-swipe-dismiss", direction);
    dialog.close();
    // Once it has left: a reopened drawer starts from its edge.
    void afterAnimations(dialog).then(() => {
      if (dialog.open) return;
      dialog.removeAttribute("data-swipe-dismiss");
      reset(dialog);
    });
  } else reset(dialog);
}

function on<K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
  options: AddEventListenerOptions = {},
) {
  document.addEventListener(type, listener, { capture: true, ...options });
}

// Mouse and pen: pointer events. Touch: touch events, so the swipe can take the gesture from
// scrolling only once it is one.
on("pointerdown", (event) => {
  if (event.pointerType !== "touch" && event.button === 0 && event.isPrimary) {
    start(event.target, event.clientX, event.clientY);
  }
});
on("pointermove", (event) => {
  if (event.pointerType !== "touch" && move(event.clientX, event.clientY)) event.preventDefault();
});
on("pointerup", (event) => {
  if (event.pointerType !== "touch") end();
});
on("pointercancel", (event) => {
  if (event.pointerType !== "touch" && drag) {
    reset(drag.dialog);
    drag.dialog.removeAttribute("data-swiping");
    drag = undefined;
  }
});
on("touchstart", (event) => {
  const touch = event.touches[0];
  if (event.touches.length === 1 && touch) start(event.target, touch.clientX, touch.clientY);
  else if (drag) end();
});
on(
  "touchmove",
  (event) => {
    const touch = event.touches[0];
    if (touch && move(touch.clientX, touch.clientY)) event.preventDefault();
  },
  { passive: false },
);
on("touchend", () => end());
on("touchcancel", () => end());
// A drawer that opens again starts from its edge.
on("toggle", (event) => {
  const dialog = event.target;
  if (dialog instanceof HTMLDialogElement && dialog.open && dialog.dataset["swipeDirection"]) {
    dialog.removeAttribute("data-swipe-dismiss");
    reset(dialog);
  }
});
