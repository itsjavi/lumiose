// Popover (decision-62, TASK-356): a native `popover="auto"` opened and closed by its trigger's
// `popovertarget`, so it works in server HTML with no JavaScript, placed next to the trigger with
// CSS anchor positioning (placement.css). The popup is a non-modal dialog (`role="dialog"`), as in
// Base UI and Zag. The popup element is the only state: the trigger, a close button, Escape, a
// click outside and the `open` prop all end in its `toggle` event, the single source of
// `onOpenChange`. Ported from Timeless's approach (https://timeless.build).
import {
  createContext,
  effect,
  isServer,
  onCleanup,
  ref,
  signal,
  untrack,
  useContext,
  useId,
  type Signal,
} from "lumiose";
import { anchorName, placement, withStyle, type PlacementProps } from "../placement/placement.ts";
import popoverScript from "./popover.script.ts?client";

/**
 * `Popover.Root` renders no element: it holds the ids its parts share. `bind:open={signal}`
 * stands in for `open` and `onOpenChange`.
 */
export interface PopoverRootProps {
  /**
   * Opens (`true`) or closes (`false`) the popover when it changes, in the browser. Pair it with
   * `onOpenChange` to keep a signal in sync; leave both out and the popover keeps its own state.
   * Server HTML always starts closed: a popover only opens from script or its trigger.
   */
  open?: boolean;
  /** Called after the popover opens or closes, whatever opened or closed it. */
  onOpenChange?: (open: boolean) => void;
  /** The other parts: a `Popover.Trigger` and the `Popover.Popup`, anywhere inside. */
  children?: JSX.Element;
}

/** A `<button>` that opens and closes the popover (`popovertarget`), and its anchor. */
export type PopoverTriggerProps = JSX.IntrinsicElements["button"];
/** The popup: a `<div popover role="dialog">`, placed next to the trigger. */
export type PopoverPopupProps = JSX.IntrinsicElements["div"] & PlacementProps;
/** The `<h2>` that names the popover. */
export type PopoverTitleProps = JSX.IntrinsicElements["h2"];
/** The `<p>` that describes the popover. */
export type PopoverDescriptionProps = JSX.IntrinsicElements["p"];
/** A `<button>` that closes the popover (`popovertargetaction="hide"`). */
export type PopoverCloseProps = JSX.IntrinsicElements["button"];

interface PopoverContextValue {
  id: string;
  trigger: JSX.Ref<HTMLButtonElement>;
  popup: JSX.Ref<HTMLDivElement>;
  onToggle: (open: boolean) => void;
  popupId: string;
  titleId: string;
  descriptionId: string;
  /** How many Title and Description parts are rendered: the popup references only those. */
  titles: Signal<number>;
  descriptions: Signal<number>;
}

const PopoverContext = createContext<PopoverContextValue>();

function usePopover(): PopoverContextValue {
  const context = useContext(PopoverContext);
  if (!context) throw new Error("Popover parts must be inside <Popover.Root>.");
  return context;
}

function Root(props: PopoverRootProps) {
  // Focus on open and its return, `aria-expanded`, and placement without anchor positioning; the
  // page loads it once (decision-63).
  popoverScript();
  const id = useId();
  const trigger = ref<HTMLButtonElement>();
  const popup = ref<HTMLDivElement>();
  const context: PopoverContextValue = {
    id,
    trigger,
    popup,
    onToggle: (next) => props.onOpenChange?.(next),
    popupId: `${id}-popup`,
    titleId: `${id}-title`,
    descriptionId: `${id}-description`,
    titles: signal(0),
    descriptions: signal(0),
  };

  // The `open` prop drives the native state; the popup's `toggle` event reports back, so a signal
  // written by `onOpenChange` sees the same value again and nothing loops.
  effect(() => {
    const element = popup();
    const wanted = props.open;
    if (!element?.isConnected || wanted === undefined) return;
    const shown = element.matches(":popover-open");
    // `source` makes the trigger the popover's invoker, as a click on it does: focus order and
    // nesting follow it.
    if (wanted && !shown) {
      (element.showPopover as (options?: { source?: HTMLElement }) => void)({
        source: trigger(),
      });
    } else if (!wanted && shown) element.hidePopover();
  });

  return <PopoverContext value={context}>{props.children}</PopoverContext>;
}

// Each part spreads the caller's props first, so they override the defaults (`type`, the label
// references), and sets the wiring last, so `id` and `popovertarget` stay consistent.

function Trigger({ children, ref: forwarded, ...rest }: PopoverTriggerProps) {
  const popover = usePopover();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      {...rest}
      ref={(element: HTMLButtonElement) => {
        popover.trigger(element);
        forwarded?.(element);
      }}
      style={withStyle(rest.style, { "anchor-name": anchorName(popover.id) })}
      popovertarget={popover.popupId}
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
}: PopoverPopupProps) {
  const popover = usePopover();
  // The server writes the attributes before it renders the children, so it renders them first to
  // know which Title and Description exist (as Dialog.Popup does), once.
  const content = isServer ? untrack(() => children) : undefined;
  return (
    <div
      role="dialog"
      aria-labelledby={popover.titles() > 0 ? popover.titleId : undefined}
      aria-describedby={popover.descriptions() > 0 ? popover.descriptionId : undefined}
      {...rest}
      {...placement(
        { side, align, sideOffset, alignOffset, style: rest.style },
        popover.id,
        "bottom",
      )}
      ref={(element: HTMLDivElement) => {
        popover.popup(element);
        forwarded?.(element);
      }}
      id={popover.popupId}
      popover="auto"
      on:toggle={(event: ToggleEvent) => popover.onToggle(event.newState === "open")}
    >
      {isServer ? content : children}
    </div>
  );
}

/** Counts a rendered part in `count` while it is mounted. */
function register(count: Signal<number>) {
  count.update((n) => n + 1);
  onCleanup(() => count.update((n) => n - 1));
}

function Title({ children, ...rest }: PopoverTitleProps) {
  const popover = usePopover();
  register(popover.titles);
  return (
    <h2 {...rest} id={popover.titleId}>
      {children}
    </h2>
  );
}

function Description({ children, ...rest }: PopoverDescriptionProps) {
  const popover = usePopover();
  register(popover.descriptions);
  return (
    <p {...rest} id={popover.descriptionId}>
      {children}
    </p>
  );
}

function Close({ children, ...rest }: PopoverCloseProps) {
  const popover = usePopover();
  return (
    <button type="button" {...rest} popovertarget={popover.popupId} popovertargetaction="hide">
      {children}
    </button>
  );
}

/**
 * A popup anchored to its trigger: a non-modal dialog that a click outside, Escape or a close
 * button dismisses. No JavaScript needed: the native popover and `popovertarget` do the work, in
 * server HTML too. Unstyled: style the parts through `class` and native state (`:popover-open`,
 * `[aria-expanded]`, `[data-side]`).
 *
 * @example
 * <Popover.Root>
 *   <Popover.Trigger>Notifications</Popover.Trigger>
 *   <Popover.Popup side="bottom" align="start" sideOffset={8}>
 *     <Popover.Title>Notifications</Popover.Title>
 *     <Popover.Description>You are all caught up.</Popover.Description>
 *     <Popover.Close>Close</Popover.Close>
 *   </Popover.Popup>
 * </Popover.Root>
 */
export const Popover = { Root, Trigger, Popup, Title, Description, Close };
