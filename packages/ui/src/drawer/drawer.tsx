// Drawer (decision-62, TASK-382): a Dialog against an edge of the window that a swipe toward that
// edge closes, after Base UI's Drawer. Its parts are Dialog's (a native modal `<dialog>` opened by
// an invoker command, so it works in server HTML with no JavaScript); Popup adds
// `data-swipe-direction`, which drawer.css turns into the edge it sits on, and the client script
// (./drawer.script.ts) the swipe. Ported from Timeless's approach (https://timeless.build).
import { createContext, useContext } from "lumiose";
import {
  Dialog,
  type DialogCloseProps,
  type DialogDescriptionProps,
  type DialogPopupProps,
  type DialogTitleProps,
  type DialogTriggerProps,
} from "../dialog/dialog.tsx";
import drawerScript from "./drawer.script.ts?client";

/** The direction a swipe closes the drawer in, and the edge of the window it sits against. */
export type DrawerSwipeDirection = "up" | "down" | "left" | "right";

/**
 * `Drawer.Root` renders no element: it holds the state the other parts share, as `Dialog.Root`.
 * `bind:open={signal}` stands in for `open` and `onOpenChange`.
 */
export interface DrawerRootProps {
  /**
   * Opens (`true`) or closes (`false`) the drawer when it changes, in the browser. Pair it with
   * `onOpenChange` to keep a signal in sync; leave both out and the drawer keeps its own state.
   * Server HTML always starts closed: a modal dialog only opens from script or a trigger.
   */
  open?: boolean;
  /** Called after the drawer opens or closes, whatever did it: a swipe included. */
  onOpenChange?: (open: boolean) => void;
  /**
   * The direction a swipe closes the drawer in, which is also the window's edge it sits against.
   * Default `"down"`: a bottom sheet.
   */
  swipeDirection?: DrawerSwipeDirection;
  /** The other parts: a `Drawer.Trigger` and the `Drawer.Popup`, anywhere inside. */
  children?: JSX.Element;
}

/** The `<button>` that opens the drawer, as `Dialog.Trigger`. */
export type DrawerTriggerProps = DialogTriggerProps;
/** The drawer: a `<dialog>` with `data-swipe-direction`, against that edge of the window. */
export type DrawerPopupProps = DialogPopupProps;
/** A `<div>` around the drawer's content, which may scroll: a swipe inside it waits for its top. */
export type DrawerContentProps = JSX.IntrinsicElements["div"];
/** The `<h2>` that names the drawer. */
export type DrawerTitleProps = DialogTitleProps;
/** The `<p>` that describes the drawer. */
export type DrawerDescriptionProps = DialogDescriptionProps;
/** A `<button>` that closes the drawer: the alternative to the swipe. */
export type DrawerCloseProps = DialogCloseProps;

const DrawerContext = createContext<{ direction: () => DrawerSwipeDirection }>();

function Root(props: DrawerRootProps) {
  // The swipe; the page loads it once (decision-63). Dialog.Root loads Dialog's script.
  drawerScript();
  return (
    <DrawerContext value={{ direction: () => props.swipeDirection ?? "down" }}>
      <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
        {props.children}
      </Dialog.Root>
    </DrawerContext>
  );
}

function Popup({ children, ...rest }: DrawerPopupProps) {
  const drawer = useContext(DrawerContext);
  if (!drawer) throw new Error("Drawer parts must be inside <Drawer.Root>.");
  return (
    <Dialog.Popup {...rest} data-swipe-direction={drawer.direction()}>
      {children}
    </Dialog.Popup>
  );
}

function Content({ children, ...rest }: DrawerContentProps) {
  return <div {...rest}>{children}</div>;
}

/**
 * A panel that slides in from an edge of the window: a modal dialog, so it opens from its trigger
 * in server HTML with no JavaScript, and a swipe toward its edge closes it, as do its close
 * buttons, Escape and a click on the backdrop. Unstyled: style it through `class`,
 * `[data-swipe-direction]`, `[open]`, `[data-swiping]`, `[data-swipe-dismiss]` and the
 * `--drawer-swipe-movement-x`/`-y` and `--drawer-swipe-progress` variables.
 *
 * @example
 * <Drawer.Root>
 *   <Drawer.Trigger>Filters</Drawer.Trigger>
 *   <Drawer.Popup>
 *     <Drawer.Title>Filters</Drawer.Title>
 *     <Drawer.Content>…</Drawer.Content>
 *     <Drawer.Close>Done</Drawer.Close>
 *   </Drawer.Popup>
 * </Drawer.Root>
 */
export const Drawer = {
  Root,
  Trigger: Dialog.Trigger,
  Popup,
  Content,
  Title: Dialog.Title,
  Description: Dialog.Description,
  Close: Dialog.Close,
};
