// Places an anchored popup next to its trigger where CSS anchor positioning is missing (Firefox
// before 147, Safari before 26): the same sides, alignment, offsets and flips as placement.css,
// from the popup's `data-side` and `data-align`. Client scripts call it while a popup is open.
// It must not import `lumiose`: server-rendered pages load it without the runtime.

export const anchoring = typeof CSS !== "undefined" && CSS.supports("anchor-name: --a");

const px = (style: CSSStyleDeclaration, name: string) =>
  Number.parseFloat(style.getPropertyValue(name)) || 0;

/** Sets the popup's position from its trigger's box, in viewport pixels. */
export function place(popup: HTMLElement, trigger: Element) {
  const style = getComputedStyle(popup);
  const rtl = style.direction === "rtl";
  const gap = px(style, "--lu-side-offset");
  const shift = px(style, "--lu-align-offset");
  const align = popup.dataset.align ?? "center";
  let side = popup.dataset.side ?? "bottom";
  if (side === "inline-start") side = rtl ? "right" : "left";
  if (side === "inline-end") side = rtl ? "left" : "right";

  const a = trigger.getBoundingClientRect();
  const { offsetWidth: w, offsetHeight: h } = popup;
  const { innerWidth: vw, innerHeight: vh } = window;
  // Flip to the opposite side when the popup does not fit and fits there.
  if (side === "bottom" && a.bottom + gap + h > vh && a.top - gap - h >= 0) side = "top";
  else if (side === "top" && a.top - gap - h < 0 && a.bottom + gap + h <= vh) side = "bottom";
  else if (side === "right" && a.right + gap + w > vw && a.left - gap - w >= 0) side = "left";
  else if (side === "left" && a.left - gap - w < 0 && a.right + gap + w <= vw) side = "right";
  // Beside the trigger on neither side: below it, or above it, centred.
  let centred = align === "center";
  if ((side === "left" || side === "right") && a.left - gap - w < 0 && a.right + gap + w > vw) {
    side = a.bottom + gap + h <= vh || a.top - gap - h < 0 ? "bottom" : "top";
    centred = true;
  }

  let x: number;
  let y: number;
  if (side === "top" || side === "bottom") {
    y = side === "bottom" ? a.bottom + gap : a.top - gap - h;
    const start = rtl ? a.right - w - shift : a.left + shift;
    const end = rtl ? a.left + shift : a.right - w - shift;
    x = centred ? a.left + (a.width - w) / 2 + shift : align === "start" ? start : end;
    x = Math.min(Math.max(x, 0), vw - w);
  } else {
    x = side === "right" ? a.right + gap : a.left - gap - w;
    y =
      align === "start"
        ? a.top + shift
        : align === "end"
          ? a.bottom - h - shift
          : a.top + (a.height - h) / 2 + shift;
    y = Math.min(Math.max(y, 0), vh - h);
  }
  Object.assign(popup.style, { inset: "auto", margin: "0", left: `${x}px`, top: `${y}px` });
}
