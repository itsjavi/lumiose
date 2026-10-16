// Navigation Menu (decision-62, TASK-380): site navigation whose items open panels of links, after
// Base UI's NavigationMenu and the WAI-ARIA disclosure navigation pattern. Root is a `<nav>`
// landmark (a `<div>` when nested in another menu's panel) around a list; each item's trigger
// opens its content through `popovertarget`: a `popover="auto"` placed under the trigger by CSS
// anchor positioning. So without JavaScript the links work, a panel opens on a click, one at a
// time, and closes on Escape or a click outside. `<lu-navigation-menu>`
// (./navigation-menu.script.ts) adds hover intent, the arrow keys, closing when focus leaves,
// `value` and the activation direction. Base UI's Viewport, Positioner, Portal, Backdrop and Arrow
// are left out: the top layer and anchor positioning place each panel, and without a portal the
// panels cannot share one viewport.
import { createContext, Dynamic, effect, onMount, ref, untrack, useContext, useId } from "lumiose";
import { anchorName, placement, withStyle, type PlacementProps } from "../placement/placement.ts";
import navigationMenuScript from "./navigation-menu.script.ts?client";
import type {
  NavigationMenuElement,
  NavigationMenuValueChangeDetail,
} from "./navigation-menu.script.ts";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * NavigationMenu.Root's element: it opens and closes its items' contents. Property `value`;
       * event `valuechange` (`detail.value`).
       */
      "lu-navigation-menu": JSX.HTMLProps<NavigationMenuElement> & {
        "data-delay"?: number;
        "data-close-delay"?: number;
      };
    }
  }
}

/** Which way a navigation menu's items run. */
export type NavigationMenuOrientation = "horizontal" | "vertical";

/**
 * `NavigationMenu.Root` renders a `<nav>` (a `<div>` inside another navigation menu's content)
 * inside `<lu-navigation-menu>`. `bind:value={signal}` stands in for `value` and `onValueChange`.
 */
export type NavigationMenuRootProps = Omit<JSX.IntrinsicElements["nav"], symbol> & {
  /**
   * The `value` of the item whose content is open, or `null` for none; opens or closes them when it
   * changes, in the browser. Pair it with `onValueChange`; leave both out and the menu keeps its own
   * state. Server HTML always starts closed.
   */
  value?: string | null;
  /** The item open at first, in the browser, when `value` is left out. */
  defaultValue?: string | null;
  /** Called after an item's content opens (its `value`) or the open one closes (`null`). */
  onValueChange?: (value: string | null) => void;
  /** How long the pointer rests on a trigger before its content opens, in milliseconds. Default `50`. */
  delay?: number;
  /** How long after the pointer leaves an item its content closes, in milliseconds. Default `50`. */
  closeDelay?: number;
  /**
   * Which way the items run: `"vertical"` moves between them with Arrow Up and Down, and places
   * contents at the inline end. Default `"horizontal"`.
   */
  orientation?: NavigationMenuOrientation;
};

/** A `<ul>` of the menu's items. */
export type NavigationMenuListProps = JSX.IntrinsicElements["ul"];

/** An `<li>`: a trigger with its content, or a link. */
export type NavigationMenuItemProps = JSX.IntrinsicElements["li"] & {
  /** The value `Root`'s `value` names this item by. Default: a generated id. */
  value?: string;
};

/** The `<button popovertarget="…">` that opens and closes its item's content. */
export type NavigationMenuTriggerProps = JSX.IntrinsicElements["button"];

/** A `<span aria-hidden="true">` inside the trigger, such as a chevron. */
export type NavigationMenuIconProps = JSX.IntrinsicElements["span"];

/** The `<div popover="auto">` of an item's links, placed next to its trigger. */
export type NavigationMenuContentProps = JSX.IntrinsicElements["div"] & PlacementProps;

/** An `<a>`: a link in the list or in a content. */
export type NavigationMenuLinkProps = JSX.IntrinsicElements["a"] & {
  /** The link to the current page: `aria-current="page"` and `data-active`. */
  active?: boolean;
  /** Whether following the link closes the open content. Default `false`. */
  closeOnClick?: boolean;
};

interface RootContextValue {
  orientation: NavigationMenuOrientation;
}

interface ItemContextValue {
  id: string;
}

const RootContext = createContext<RootContextValue>();
const ItemContext = createContext<ItemContextValue>();

function useItem(part: string): ItemContextValue {
  const item = useContext(ItemContext);
  if (!item) throw new Error(`NavigationMenu.${part} must be inside <NavigationMenu.Item>.`);
  return item;
}

function Root({
  value,
  defaultValue,
  onValueChange,
  delay,
  closeDelay,
  orientation,
  children,
  ...rest
}: NavigationMenuRootProps) {
  // Hover intent, keys and `value` where JavaScript runs; the page loads it once (decision-63).
  navigationMenuScript();
  const nested = useContext(RootContext) !== undefined;
  const host = ref<NavigationMenuElement>();
  const vertical = () => orientation === "vertical";

  // `value` drives the element; its `valuechange` event reports back, so a signal written by
  // `onValueChange` sees the same value again and nothing loops. A content opened from the server
  // HTML before the island hydrated stays open, and the signal hears of it.
  let mounted = false;
  effect(() => {
    const element = host();
    const wanted = value;
    if (!element?.isConnected || wanted === undefined) return;
    if (!mounted && wanted === null && element.value !== null) {
      untrack(() => onValueChange?.(element.value));
    } else {
      element.value = wanted;
    }
    mounted = true;
  });
  onMount(() => {
    const element = host();
    if (element && value === undefined && defaultValue != null) element.value = defaultValue;
  });

  const attributes = () => ({
    ...rest,
    "data-orientation": vertical() ? "vertical" : "horizontal",
  });
  return (
    <RootContext value={{ orientation: vertical() ? "vertical" : "horizontal" }}>
      <lu-navigation-menu
        ref={host}
        data-delay={delay}
        data-close-delay={closeDelay}
        data-orientation={vertical() ? "vertical" : "horizontal"}
        on:valuechange={(event: CustomEvent<NavigationMenuValueChangeDetail>) =>
          onValueChange?.(event.detail.value)
        }
      >
        {/* A nested menu is a `<div>`, inside its parent's landmark. */}
        <Dynamic component={nested ? "div" : "nav"} {...attributes()}>
          {children}
        </Dynamic>
      </lu-navigation-menu>
    </RootContext>
  );
}

// Children are rendered explicitly: a spread does not pass them on (TASK-347).
function List({ children, ...rest }: NavigationMenuListProps) {
  return <ul {...rest}>{children}</ul>;
}

function Item({ value, children, ...rest }: NavigationMenuItemProps) {
  const id = useId();
  return (
    <ItemContext value={{ id }}>
      <li {...rest} data-value={value ?? id}>
        {children}
      </li>
    </ItemContext>
  );
}

function Trigger({ children, style, ...rest }: NavigationMenuTriggerProps) {
  const item = useItem("Trigger");
  return (
    <button
      type="button"
      {...rest}
      // Nothing points at the trigger: a caller's `id` names it (TASK-441 M39).
      id={rest.id ?? `${item.id}-trigger`}
      popovertarget={`${item.id}-content`}
      style={withStyle(style, { "anchor-name": anchorName(item.id) })}
    >
      {children}
    </button>
  );
}

function Icon({ children, ...rest }: NavigationMenuIconProps) {
  return (
    <span aria-hidden="true" {...rest}>
      {children}
    </span>
  );
}

function Content({
  children,
  side,
  align,
  sideOffset,
  alignOffset,
  style,
  ...rest
}: NavigationMenuContentProps) {
  const item = useItem("Content");
  const root = useContext(RootContext);
  return (
    <div
      {...rest}
      id={`${item.id}-content`}
      popover="auto"
      {...placement(
        { side, align, sideOffset, alignOffset, style },
        item.id,
        root?.orientation === "vertical" ? "inline-end" : "bottom",
        root?.orientation === "vertical" ? "start" : "center",
      )}
    >
      {children}
    </div>
  );
}

function Link({ children, active, closeOnClick, ...rest }: NavigationMenuLinkProps) {
  return (
    <a
      {...rest}
      aria-current={active ? "page" : rest["aria-current"]}
      data-active={active || undefined}
      data-close-on-click={closeOnClick ? "true" : undefined}
    >
      {children}
    </a>
  );
}

/**
 * Site navigation whose items open panels of links, after Base UI's NavigationMenu: Root, List,
 * Item, Trigger, Icon, Content and Link. A `<nav>` landmark whose links work without JavaScript.
 *
 * @example
 * <NavigationMenu.Root aria-label="Main">
 *   <NavigationMenu.List>
 *     <NavigationMenu.Item>
 *       <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
 *       <NavigationMenu.Content>
 *         <NavigationMenu.Link href="/analytics">Analytics</NavigationMenu.Link>
 *       </NavigationMenu.Content>
 *     </NavigationMenu.Item>
 *     <NavigationMenu.Item>
 *       <NavigationMenu.Link href="/pricing">Pricing</NavigationMenu.Link>
 *     </NavigationMenu.Item>
 *   </NavigationMenu.List>
 * </NavigationMenu.Root>
 */
export const NavigationMenu = { Root, List, Item, Trigger, Icon, Content, Link };
