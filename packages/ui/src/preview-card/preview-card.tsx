// Preview Card (decision-62, TASK-381): a card that previews a link's destination on hover and on
// keyboard focus, after Base UI's PreviewCard. The trigger is the link itself; the popup is a
// manual popover placed next to it with CSS anchor positioning (Popover's placement.css), which
// preview-card.script.ts opens and closes with Popover's hover timing (../popover/hover.ts).
// Without JavaScript the link is just a link. The popup's `toggle` event is the single source of
// `onOpenChange`; the `open` prop drives it in the browser.
import { createContext, effect, ref, useContext, useId } from "lumiose";
import { anchorName, placement, withStyle, type PlacementProps } from "../placement/placement.ts";
import previewCardScript from "./preview-card.script.ts?client";
import { batched } from "../batched.ts";
import { notInside } from "../not-inside.ts";

/**
 * `PreviewCard.Root` renders no element: it holds the ids its parts share. `bind:open={signal}`
 * stands in for `open` and `onOpenChange`.
 */
export interface PreviewCardRootProps {
  /** Opens (`true`) or closes (`false`) the card when it changes, in the browser. */
  open?: boolean;
  /** Called after the card opens or closes, whatever opened or closed it. */
  onOpenChange?: (open: boolean) => void;
  /** The other parts: the `Trigger` and the `Popup`, anywhere inside. */
  children?: JSX.Element;
}

/** The link: an `<a href>` whose hover and keyboard focus open the card. */
export type PreviewCardTriggerProps = JSX.IntrinsicElements["a"] & {
  /** How long the pointer or focus rests on the link before the card opens, in ms. Default `600`. */
  delay?: number;
  /** How long the card stays after the pointer leaves the link and the card, in ms. Default `300`. */
  closeDelay?: number;
};

/** The card: a `<div popover="manual">` placed next to the link. */
export type PreviewCardPopupProps = JSX.IntrinsicElements["div"] & PlacementProps;

interface PreviewCardContextValue {
  id: string;
  popupId: string;
  popup: JSX.Ref<HTMLDivElement>;
  onToggle: (open: boolean) => void;
}

const PreviewCardContext = createContext<PreviewCardContextValue>();

function usePreviewCard(part: string): PreviewCardContextValue {
  const context = useContext(PreviewCardContext);
  if (!context) throw notInside(`PreviewCard.${part}`, "<PreviewCard.Root>");
  return context;
}

function Root(props: PreviewCardRootProps) {
  // Hover, focus, dismissal and fallback placement; the page loads it once (decision-63).
  previewCardScript();
  const id = useId();
  const popup = ref<HTMLDivElement>();
  // The `open` prop drives the popover; its `toggle` event reports back.
  effect(() => {
    const element = popup();
    const wanted = props.open;
    if (!element?.isConnected || wanted === undefined) return;
    const shown = element.matches(":popover-open");
    if (wanted && !shown) element.showPopover();
    else if (!wanted && shown) element.hidePopover();
  });
  const context: PreviewCardContextValue = {
    id,
    popupId: `${id}-popup`,
    popup,
    onToggle: (next) => props.onOpenChange?.(next),
  };
  return <PreviewCardContext value={context}>{props.children}</PreviewCardContext>;
}

function Trigger({ children, delay, closeDelay, style, ...rest }: PreviewCardTriggerProps) {
  const card = usePreviewCard("Trigger");
  return (
    <a
      {...rest}
      style={withStyle(style, { "anchor-name": anchorName(card.id) })}
      data-preview-card={card.popupId}
      data-delay={delay}
      data-close-delay={closeDelay}
    >
      {children}
    </a>
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
}: PreviewCardPopupProps) {
  const card = usePreviewCard("Popup");
  return (
    <div
      {...rest}
      {...placement({ side, align, sideOffset, alignOffset, style: rest.style }, card.id, "bottom")}
      ref={(element: HTMLDivElement) => {
        card.popup(element);
        forwarded?.(element);
      }}
      id={card.popupId}
      popover="manual"
      data-preview-card-popup=""
      on:toggle={batched((event: ToggleEvent) => card.onToggle(event.newState === "open"))}
    >
      {children}
    </div>
  );
}

/**
 * A preview of a link's destination, shown while the pointer or keyboard focus rests on the link,
 * after Base UI's PreviewCard. A visual enhancement: the link works without it (and without
 * JavaScript), so the card should not hold anything the linked page lacks. Unstyled: style the
 * parts through `class`, `:popover-open`, `[data-side]` and the link's `[data-popup-open]`.
 *
 * @example
 * <PreviewCard.Root>
 *   <PreviewCard.Trigger href="/docs/signals">signals</PreviewCard.Trigger>
 *   <PreviewCard.Popup sideOffset={8}>Values that update what reads them.</PreviewCard.Popup>
 * </PreviewCard.Root>
 */
export const PreviewCard = { Root, Trigger, Popup };
