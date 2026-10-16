// Scroll Area (decision-62, TASK-384): native scrolling with custom scrollbars laid over it, after
// Base UI's ScrollArea. Root renders `<lu-scroll-area>`, whose script (scroll-area.script.ts) hides
// the native scrollbar and sizes, moves and drags the custom ones, and writes the overflow state as
// data attributes and CSS variables. The Viewport scrolls natively, is focusable while it
// overflows (keyboard scrolling) and traps nothing; without JavaScript its native scrollbars show.
import scrollAreaScript from "./scroll-area.script.ts?client";
import type { ScrollAreaElement } from "./scroll-area.script.ts";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * Scroll Area's element. Attribute `overflow-edge-threshold`; the overflow data attributes
       * and `--lu-scroll-area-corner-width` and `-height` from its script.
       */
      "lu-scroll-area": JSX.HTMLProps<ScrollAreaElement> & { "overflow-edge-threshold"?: number };
    }
  }
}

/**
 * `ScrollArea.Root` renders `<lu-scroll-area>`, around the Viewport and the scrollbars. Give it a
 * size (a height, a max height): the Viewport fills it.
 */
export type ScrollAreaRootProps = JSX.HTMLProps<ScrollAreaElement> & {
  /**
   * How many px of content past an edge before `data-overflow-*-start` or `-end` applies.
   * Default `0`.
   */
  overflowEdgeThreshold?: number;
};

/**
 * The `<div data-viewport>` that scrolls, natively: focusable (`tabindex="0"`) while it overflows,
 * so the keyboard scrolls it. Give it an `aria-label` (and `role="region"`) when it holds a
 * landmark-worthy section.
 */
export type ScrollAreaViewportProps = JSX.IntrinsicElements["div"];

/** A `<div>` around the content, sized to it. */
export type ScrollAreaContentProps = JSX.IntrinsicElements["div"];

/** A custom scrollbar, `<div data-scrollbar aria-hidden="true">` over an edge of the viewport. */
export type ScrollAreaScrollbarProps = JSX.IntrinsicElements["div"] & {
  /** The edge and axis: `"vertical"` (default, the inline end) or `"horizontal"` (the bottom). */
  orientation?: "vertical" | "horizontal";
  /** Keeps the scrollbar shown while its axis does not overflow. */
  keepMounted?: boolean;
};

/** The scrollbar's `<div data-thumb>`, sized and moved by the script; drag it to scroll. */
export type ScrollAreaThumbProps = JSX.IntrinsicElements["div"];

/** A `<div data-corner>` where the two scrollbars meet, shown while both axes overflow. */
export type ScrollAreaCornerProps = JSX.IntrinsicElements["div"];

function Root({ overflowEdgeThreshold, children, ...rest }: ScrollAreaRootProps) {
  // The custom scrollbars and the overflow state (decision-63).
  scrollAreaScript();
  return (
    <lu-scroll-area {...rest} overflow-edge-threshold={overflowEdgeThreshold}>
      {children}
    </lu-scroll-area>
  );
}

function Viewport({ children, ...rest }: ScrollAreaViewportProps) {
  return (
    <div tabindex={0} {...rest} data-viewport="">
      {children}
    </div>
  );
}

function Content({ children, ...rest }: ScrollAreaContentProps) {
  return <div {...rest}>{children}</div>;
}

function Scrollbar({ orientation, keepMounted, children, ...rest }: ScrollAreaScrollbarProps) {
  return (
    <div
      {...rest}
      aria-hidden="true"
      data-scrollbar=""
      data-orientation={orientation ?? "vertical"}
      data-keep-mounted={keepMounted ? "" : undefined}
    >
      {children}
    </div>
  );
}

function Thumb(props: ScrollAreaThumbProps) {
  return <div {...props} data-thumb="" />;
}

function Corner(props: ScrollAreaCornerProps) {
  return <div {...props} data-corner="" hidden />;
}

/**
 * A scrolling region with custom scrollbars over native scrolling, after Base UI's ScrollArea: the
 * wheel, touch, the keyboard and find-in-page scroll it as any scroller, and the scrollbars show
 * where it is. Unstyled: style the parts through `class`, `[data-orientation]`, `[data-hovering]`,
 * `[data-scrolling]`, `[data-has-overflow-y]`, `[data-overflow-y-end]` and the
 * `--lu-scroll-area-*` custom properties.
 *
 * @example
 * <ScrollArea.Root style={{ height: "12rem" }}>
 *   <ScrollArea.Viewport aria-label="Release notes" role="region">
 *     <ScrollArea.Content>…</ScrollArea.Content>
 *   </ScrollArea.Viewport>
 *   <ScrollArea.Scrollbar>
 *     <ScrollArea.Thumb />
 *   </ScrollArea.Scrollbar>
 * </ScrollArea.Root>
 */
export const ScrollArea = { Root, Viewport, Content, Scrollbar, Thumb, Corner };
