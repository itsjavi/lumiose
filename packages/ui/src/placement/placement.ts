// Placement of the popups anchored to a trigger (Popover, Tooltip; decision-62: placement props on
// `Popup`, no `Positioner`). The trigger gets an anchor name and the popup points at it, both in
// inline styles, so CSS anchor positioning places the popup from the server HTML on; placement.css
// reads the popup's `data-side` and `data-align` and the offsets' custom properties, in `lu.core`.
// Browsers without anchor positioning get the same placement from ./place.ts.

/** The trigger's side the popup goes on. `inline-start` and `inline-end` follow the direction. */
export type Side = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
/** How the popup aligns with the trigger along that side. */
export type Align = "start" | "center" | "end";

export interface PlacementProps {
  /** The trigger's side the popup goes on. It flips to the opposite side when it does not fit. */
  side?: Side;
  /** How the popup aligns with the trigger along that side. Default `"center"`. */
  align?: Align;
  /** The gap between the trigger and the popup, in CSS pixels. */
  sideOffset?: number;
  /** A shift along the side, away from the aligned edge, in CSS pixels. */
  alignOffset?: number;
}

type Style = string | JSX.CSSProperties | undefined;

/** The anchor name that ties a popup to its trigger, from the id the parts share. */
export const anchorName = (id: string) => `--lu-${id}`;

/** `style` with `extra` in front, so the caller's own declarations win. */
export function withStyle(style: Style, extra: JSX.CSSProperties): string | JSX.CSSProperties {
  if (typeof style === "string") {
    const ours = Object.entries(extra)
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => `${name}: ${value}`)
      .join("; ");
    return `${ours}; ${style}`;
  }
  return { ...extra, ...style };
}

/**
 * The anchored popup's attributes: its placement, and its anchor and offsets in `style`.
 * `defaultSide` and `defaultAlign` apply when the props leave them out.
 */
export function placement(
  props: PlacementProps & { style?: Style },
  id: string,
  defaultSide: Side,
  defaultAlign: Align = "center",
) {
  return {
    "data-side": props.side ?? defaultSide,
    "data-align": props.align ?? defaultAlign,
    style: withStyle(props.style, {
      "position-anchor": anchorName(id),
      "--lu-side-offset": props.sideOffset === undefined ? undefined : `${props.sideOffset}px`,
      "--lu-align-offset": props.alignOffset === undefined ? undefined : `${props.alignOffset}px`,
    }),
  };
}
