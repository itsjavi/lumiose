// Tooltip (decision-62, TASK-356): a native `popover="hint"` (`manual` where the browser lacks
// hint popovers) with `role="tooltip"`, placed next to its trigger with CSS anchor positioning
// (placement.css). The trigger is described by it (`aria-describedby`), in server HTML too, so
// assistive technology reads the tip without hovering, as the APG tooltip pattern asks; the
// trigger still needs its own name. Hover and keyboard focus open it through the client script,
// which reads the trigger's delays from its attributes. Ported from Timeless's approach
// (https://timeless.build).
import { createContext, effect, ref, useContext, useId } from "lumiose";
import { anchorName, placement, withStyle, type PlacementProps } from "../placement/placement.ts";
import tooltipScript from "./tooltip.script.ts?client";

export interface TooltipRootProps {
  /**
   * Opens (`true`) or closes (`false`) the tooltip when it changes, in the browser. Pair it with
   * `onOpenChange` to keep a signal in sync; leave both out and hover and focus drive it.
   */
  open?: boolean;
  /** Called after the tooltip opens or closes, whatever opened or closed it. */
  onOpenChange?: (open: boolean) => void;
  /** Hover and focus do not open the tooltip. The `open` prop still does. */
  disabled?: boolean;
  /**
   * The tooltip closes as soon as the pointer leaves the trigger, instead of staying open while
   * the pointer moves onto it. Default `false`: WCAG 1.4.13 asks for hoverable content.
   */
  disableHoverablePopup?: boolean;
  children?: JSX.Element;
}

export type TooltipTriggerProps = JSX.IntrinsicElements["button"] & {
  /** How long the pointer rests on the trigger before the tooltip opens, in ms. Default 600. */
  delay?: number;
  /** How long the tooltip stays after the pointer leaves, in ms. Default 0. */
  closeDelay?: number;
  /** Clicking the trigger closes the tooltip. Default `true`. */
  closeOnClick?: boolean;
};
/**
 * The tip: a `<span popover role="tooltip">`, placed next to the trigger. A `<span>`, so it may sit
 * next to a trigger inside a paragraph.
 */
export type TooltipPopupProps = JSX.IntrinsicElements["span"] & PlacementProps;

interface TooltipContextValue {
  id: string;
  popupId: string;
  popup: JSX.Ref<HTMLSpanElement>;
  props: TooltipRootProps;
}

const TooltipContext = createContext<TooltipContextValue>();

function useTooltip(): TooltipContextValue {
  const context = useContext(TooltipContext);
  if (!context) throw new Error("Tooltip parts must be inside <Tooltip.Root>.");
  return context;
}

function Root(props: TooltipRootProps) {
  // Opens and closes tooltips on hover and focus, and places them without anchor positioning;
  // the page loads it once (decision-63).
  tooltipScript();
  const id = useId();
  const popup = ref<HTMLSpanElement>();
  const context: TooltipContextValue = { id, popupId: `${id}-popup`, popup, props };

  // The `open` prop drives the native state; the popup's `toggle` event reports back.
  effect(() => {
    const element = popup();
    const wanted = props.open;
    if (!element?.isConnected || wanted === undefined) return;
    const shown = element.matches(":popover-open");
    if (wanted && !shown) element.showPopover();
    else if (!wanted && shown) element.hidePopover();
  });

  return <TooltipContext value={context}>{props.children}</TooltipContext>;
}

function Trigger({ children, delay, closeDelay, closeOnClick, ...rest }: TooltipTriggerProps) {
  const tooltip = useTooltip();
  const described = () =>
    [tooltip.popupId, rest["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  return (
    <button
      type="button"
      {...rest}
      aria-describedby={described()}
      style={withStyle(rest.style, { "anchor-name": anchorName(tooltip.id) })}
      data-delay={delay}
      data-close-delay={closeDelay}
      data-close-on-click={closeOnClick === false ? "false" : undefined}
      data-trigger-disabled={tooltip.props.disabled ? "" : undefined}
    >
      {children}
    </button>
  );
}

function Popup({
  children,
  ref: forwarded,
  side,
  align,
  sideOffset,
  alignOffset,
  ...rest
}: TooltipPopupProps) {
  const tooltip = useTooltip();
  return (
    <span
      role="tooltip"
      {...rest}
      {...placement({ side, align, sideOffset, alignOffset, style: rest.style }, tooltip.id, "top")}
      data-disable-hoverable-popup={tooltip.props.disableHoverablePopup ? "" : undefined}
      ref={(element: HTMLSpanElement) => {
        tooltip.popup(element);
        forwarded?.(element);
      }}
      id={tooltip.popupId}
      popover="hint"
      on:toggle={(event: ToggleEvent) => tooltip.props.onOpenChange?.(event.newState === "open")}
    >
      {children}
    </span>
  );
}

/**
 * A short tip next to its trigger, on hover or keyboard focus. The trigger is described by it, in
 * server HTML too; give an icon-only trigger its own `aria-label`. Unstyled: style the parts
 * through `class` and native state (`:popover-open`, `[data-side]`).
 *
 * @example
 * <Tooltip.Root>
 *   <Tooltip.Trigger aria-label="Bold">B</Tooltip.Trigger>
 *   <Tooltip.Popup sideOffset={6}>Bold (⌘B)</Tooltip.Popup>
 * </Tooltip.Root>
 */
export const Tooltip = { Root, Trigger, Popup };
