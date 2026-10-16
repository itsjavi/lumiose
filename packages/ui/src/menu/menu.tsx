// Menu (decision-62, TASK-357): a popover menu with the APG Menu Button contract. The trigger opens
// the popup through `popovertarget` and CSS anchor positioning places it, so it opens in server HTML
// with no JavaScript. `lu-menu` (./menu.script.ts, loaded through the client-script import of
// decision-63) adds the keyboard, focus and item behaviour the platform lacks. The DOM is the only
// state: the popup's `toggle` event and the items' `checkedchange` events report every change, so
// `onOpenChange`, `onCheckedChange` and `onValueChange` hear what the keyboard, a click or a prop
// did. Ported from Timeless's approach (https://timeless.build), with Base UI's anatomy.
import {
  createContext,
  effect,
  isServer,
  onCleanup,
  ref,
  signal,
  useContext,
  useId,
  untrack,
  type Signal,
} from "lumiose";
import type { MenuCheckedChangeDetail, MenuElement, MenuOpenChangeDetail } from "./menu.script.ts";
import menuScript from "./menu.script.ts?client";
import { anchorName, placement, withStyle, type Align, type Side } from "../placement/placement.ts";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * Menu's element, rendered by `Menu.Root` and `Menu.SubmenuRoot`. Property `open`; event
       * `openchange` (`detail.open`); its checkbox and radio items fire `checkedchange`
       * (`detail.checked`).
       */
      "lu-menu": JSX.HTMLProps<MenuElement> & { open?: boolean };
    }
  }
}

/**
 * `Menu.Root` renders `<lu-menu>`, an element with no box that holds the menu's state and adds its
 * keyboard and item behaviour. `bind:open={signal}` stands in for `open` and `onOpenChange`.
 */
export interface MenuRootProps {
  /**
   * Opens (`true`) or closes (`false`) the menu when it changes, in the browser. Pair it with
   * `onOpenChange` to keep a signal in sync; leave both out and the menu keeps its own state.
   * Server HTML always starts closed: a popover only opens from its trigger or script.
   */
  open?: boolean;
  /** Called after the menu opens or closes, whatever opened or closed it. */
  onOpenChange?: (open: boolean) => void;
  /** The other parts: a `Trigger` (or `SubmenuTrigger`) and the `Popup`. */
  children?: JSX.Element;
}

/** A submenu: `Root`'s props, inside a `Menu.Popup`. */
export type MenuSubmenuRootProps = MenuRootProps;

/**
 * The `<button>` that opens the menu (`popovertarget`, `aria-haspopup="menu"`); `aria-expanded`
 * follows the menu where the client script runs.
 */
export type MenuTriggerProps = JSX.IntrinsicElements["button"];

/**
 * The `<div role="menu" popover>` of items, placed next to its trigger by CSS anchor positioning
 * and labelled by the trigger.
 */
export type MenuPopupProps = JSX.IntrinsicElements["div"] & {
  /**
   * The trigger's side the popup goes on: `"bottom"` (default for a menu), `"top"`, `"left"`,
   * `"right"`, `"inline-start"` or `"inline-end"` (default for a submenu). It flips to the other
   * side when it does not fit.
   */
  side?: Side;
  /** How the popup aligns with the trigger along that side. Default `"start"`. */
  align?: Align;
  /** The gap between the trigger and the popup, in CSS pixels. */
  sideOffset?: number;
  /** A shift along the side, away from the aligned edge, in CSS pixels. */
  alignOffset?: number;
};

interface ItemProps {
  /** Unavailable: it can be highlighted, but it does not run (`aria-disabled`). */
  disabled?: boolean;
  /** The text typeahead matches, when the item's text content is not it. */
  label?: string;
  /**
   * Whether running the item closes the menu. Default `true` for items and links, `false` for
   * checkbox and radio items.
   */
  closeOnClick?: boolean;
}

/**
 * A `<button role="menuitem">`: a command. Running it closes the menu and returns focus to the
 * trigger before its `onClick` runs.
 */
export type MenuItemProps = Omit<JSX.IntrinsicElements["button"], "disabled"> & ItemProps;

/** An `<a role="menuitem">`: a link. A Ctrl, Cmd or Shift click or a download leaves the menu open. */
export type MenuLinkItemProps = JSX.IntrinsicElements["a"] & Omit<ItemProps, "disabled">;

/**
 * An element's props for a part that has a bindable prop. Lumiose marks intrinsic elements' props
 * with a symbol key and offers no `bind:` on props that carry it; leaving the symbol out offers
 * `bind:checked` and `bind:value` on the part.
 */
type BindableProps<Tag extends keyof JSX.IntrinsicElements, Omitted extends string = never> = Omit<
  JSX.IntrinsicElements[Tag],
  symbol | Omitted
>;

/** A `<button role="menuitemcheckbox">` with `aria-checked`. It stays open when it toggles. */
export type MenuCheckboxItemProps = BindableProps<"button", "disabled"> &
  ItemProps & {
    /** Checks (`true`) or unchecks it when it changes. Pair it with `onCheckedChange`. */
    checked?: boolean;
    /** Whether it starts checked when `checked` is left out. */
    defaultChecked?: boolean;
    /** Called after a click, Enter or Space checks or unchecks it. */
    onCheckedChange?: (checked: boolean) => void;
  };

/** A `<div role="group">` of items, named by its `GroupLabel`. */
export type MenuGroupProps = JSX.IntrinsicElements["div"];

/** A `<div role="presentation">` that names its group. */
export type MenuGroupLabelProps = JSX.IntrinsicElements["div"];

/**
 * A `<div role="group">` of radio items, of which one is checked. `bind:value={signal}` stands in
 * for `value` and `onValueChange`.
 */
export type MenuRadioGroupProps = BindableProps<"div"> & {
  /** Checks the radio item with this `value` when it changes. Pair it with `onValueChange`. */
  value?: string;
  /** The radio item checked at first when `value` is left out. */
  defaultValue?: string;
  /** Called with the `value` of the radio item a click, Enter or Space checks. */
  onValueChange?: (value: string) => void;
};

/** A `<button role="menuitemradio">` with `aria-checked`, inside a `RadioGroup`. */
export type MenuRadioItemProps = Omit<JSX.IntrinsicElements["button"], "disabled" | "value"> &
  ItemProps & {
    /** The value its `RadioGroup` takes when it is checked. */
    value: string;
  };

/** A `<div role="separator">` between items or groups. */
export type MenuSeparatorProps = JSX.IntrinsicElements["div"];

/**
 * The `<button role="menuitem" aria-haspopup="menu">` that opens a submenu: an item of the parent
 * `Popup`, inside its `SubmenuRoot`.
 */
export type MenuSubmenuTriggerProps = Omit<JSX.IntrinsicElements["button"], "disabled"> &
  Omit<ItemProps, "closeOnClick">;

/** The ids and counts Menu's parts share; ContextMenu provides it too, to reuse the parts. */
export interface MenuContextValue {
  popupId: string;
  triggerId: string;
  /** The id the parts share; the anchor name that ties the popup to its trigger derives from it. */
  id: string;
  submenu: boolean;
  /** How many triggers are rendered: the popup is labelled by the trigger only when there is one. */
  triggers: Signal<number>;
  /** The orientation of the Menubar a top-level menu is in; `undefined` outside one. */
  menubar?: "horizontal" | "vertical";
}

/** What a Menubar tells the Menus inside it (../menubar/menubar.tsx). */
export interface MenubarContextValue {
  orientation: "horizontal" | "vertical";
}

export const MenubarContext = createContext<MenubarContextValue>();

interface GroupContextValue {
  labelId: string;
  labels: Signal<number>;
}

export const MenuContext = createContext<MenuContextValue>();
const GroupContext = createContext<GroupContextValue>();
const RadioContext = createContext<{ value: () => string | undefined }>();

function useMenu(): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) throw new Error("Menu parts must be inside <Menu.Root>.");
  return context;
}

/** Counts a rendered part in `count` while it is mounted. */
function register(count: Signal<number>) {
  count.update((n) => n + 1);
  onCleanup(() => count.update((n) => n - 1));
}

/** The item attributes shared by every kind of item. */
function itemAttributes({ disabled, label, closeOnClick }: ItemProps) {
  return {
    "aria-disabled": disabled || undefined,
    "data-label": label,
    "data-close-on-click": closeOnClick === undefined ? undefined : String(closeOnClick),
  };
}

/** The state and element of `Root` and `SubmenuRoot`, rendered by either. */
function menuRoot(props: MenuRootProps, submenu: boolean) {
  // Adds the keyboard and item behaviour where JavaScript runs; the page loads it once (decision-63).
  menuScript();
  const host = ref<MenuElement>();
  const id = useId();
  // A top-level menu of a Menubar: not a submenu, and not inside another menu.
  const bar =
    submenu || useContext(MenuContext) !== undefined ? undefined : useContext(MenubarContext);
  const context: MenuContextValue = {
    popupId: `${id}-popup`,
    triggerId: `${id}-trigger`,
    id,
    submenu,
    triggers: signal(0),
    menubar: bar?.orientation,
  };

  // The `open` prop drives the element; its `openchange` event reports back, so a signal written by
  // `onOpenChange` sees the same value again and nothing loops. A menu opened from the server HTML
  // before the island hydrated stays open, and the signal hears of it.
  let mounted = false;
  effect(() => {
    const element = host();
    const wanted = props.open;
    if (!element?.isConnected || wanted === undefined) return;
    if (!mounted && !wanted && element.open) untrack(() => props.onOpenChange?.(true));
    else element.open = wanted;
    mounted = true;
  });

  return (
    <MenuContext value={context}>
      <lu-menu
        ref={host}
        role={context.menubar ? "none" : undefined}
        on:openchange={(event: CustomEvent<MenuOpenChangeDetail>) =>
          props.onOpenChange?.(event.detail.open)
        }
      >
        {props.children}
      </lu-menu>
    </MenuContext>
  );
}

function Root(props: MenuRootProps) {
  return menuRoot(props, false);
}

function SubmenuRoot(props: MenuSubmenuRootProps) {
  return menuRoot(props, true);
}

// Each part spreads the caller's props first, so they override the defaults, and sets the wiring
// last, so the role, `id`, `popovertarget` and the anchor stay consistent between the parts.

function Trigger({ children, style, ...rest }: MenuTriggerProps) {
  const menu = useMenu();
  register(menu.triggers);
  return (
    <button
      type="button"
      {...rest}
      id={menu.triggerId}
      role={menu.menubar ? "menuitem" : undefined}
      popovertarget={menu.popupId}
      aria-haspopup="menu"
      style={withStyle(style, { "anchor-name": anchorName(menu.id) })}
    >
      {children}
    </button>
  );
}

function SubmenuTrigger({ children, disabled, label, style, ...rest }: MenuSubmenuTriggerProps) {
  const menu = useMenu();
  register(menu.triggers);
  return (
    <button
      type="button"
      {...itemAttributes({ disabled, label })}
      {...rest}
      id={menu.triggerId}
      role="menuitem"
      popovertarget={menu.popupId}
      aria-haspopup="menu"
      style={withStyle(style, { "anchor-name": anchorName(menu.id) })}
    >
      {children}
    </button>
  );
}

function Popup({ children, side, align, sideOffset, alignOffset, style, ...rest }: MenuPopupProps) {
  const menu = useMenu();
  return (
    <div
      tabindex={-1}
      aria-labelledby={menu.triggers() > 0 ? menu.triggerId : undefined}
      {...rest}
      id={menu.popupId}
      role="menu"
      popover="auto"
      {...placement(
        { side, align, sideOffset, alignOffset, style },
        menu.id,
        menu.submenu || menu.menubar === "vertical" ? "inline-end" : "bottom",
        "start",
      )}
    >
      {children}
    </div>
  );
}

function Item({ children, disabled, label, closeOnClick, ...rest }: MenuItemProps) {
  useMenu();
  return (
    <button
      type="button"
      {...itemAttributes({ disabled, label, closeOnClick })}
      {...rest}
      role="menuitem"
    >
      {children}
    </button>
  );
}

function LinkItem({ children, label, closeOnClick, ...rest }: MenuLinkItemProps) {
  useMenu();
  return (
    <a {...itemAttributes({ label, closeOnClick })} {...rest} role="menuitem">
      {children}
    </a>
  );
}

function CheckboxItem({
  children,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  label,
  closeOnClick,
  ...rest
}: MenuCheckboxItemProps) {
  useMenu();
  return (
    <button
      type="button"
      {...itemAttributes({ disabled, label, closeOnClick })}
      {...rest}
      role="menuitemcheckbox"
      aria-checked={checked ?? defaultChecked ?? false}
      on:checkedchange={(event: CustomEvent<MenuCheckedChangeDetail>) =>
        onCheckedChange?.(event.detail.checked)
      }
    >
      {children}
    </button>
  );
}

/** The `<div role="group">` of `Group` and `RadioGroup`, labelled by its `GroupLabel` if any. */
function GroupElement({
  group,
  children,
  ...rest
}: JSX.IntrinsicElements["div"] & { group: GroupContextValue }) {
  // The server writes the attributes before it renders the children: render them first to know
  // whether a GroupLabel exists. The browser updates the reference when the label registers. The
  // server renders once, so reading them once is the intent: `untrack` says so (no LUM2001).
  const content = isServer ? untrack(() => children) : undefined;
  return (
    <div aria-labelledby={group.labels() > 0 ? group.labelId : undefined} {...rest} role="group">
      {isServer ? content : children}
    </div>
  );
}

function Group(props: MenuGroupProps) {
  useMenu();
  const id = useId();
  const group: GroupContextValue = { labelId: `${id}-label`, labels: signal(0) };
  return (
    <GroupContext value={group}>
      <GroupElement {...props} group={group} />
    </GroupContext>
  );
}

function GroupLabel({ children, ...rest }: MenuGroupLabelProps) {
  const group = useContext(GroupContext);
  if (!group) throw new Error("Menu.GroupLabel must be inside <Menu.Group> or <Menu.RadioGroup>.");
  register(group.labels);
  return (
    <div role="presentation" {...rest} id={group.labelId}>
      {children}
    </div>
  );
}

function RadioGroup({
  children,
  value,
  defaultValue,
  onValueChange,
  ...rest
}: MenuRadioGroupProps) {
  useMenu();
  const id = useId();
  const group: GroupContextValue = { labelId: `${id}-label`, labels: signal(0) };
  const radio = { value: () => (value === undefined ? defaultValue : value) };
  return (
    <GroupContext value={group}>
      <RadioContext value={radio}>
        <GroupElement
          {...rest}
          group={group}
          on:checkedchange={(event: CustomEvent<MenuCheckedChangeDetail>) => {
            const item = event.target as HTMLButtonElement;
            if (item.getAttribute("role") === "menuitemradio" && event.detail.checked) {
              onValueChange?.(item.value);
            }
          }}
        >
          {children}
        </GroupElement>
      </RadioContext>
    </GroupContext>
  );
}

function RadioItem({
  children,
  value,
  disabled,
  label,
  closeOnClick,
  ...rest
}: MenuRadioItemProps) {
  useMenu();
  const radio = useContext(RadioContext);
  if (!radio) throw new Error("Menu.RadioItem must be inside <Menu.RadioGroup>.");
  return (
    <button
      type="button"
      {...itemAttributes({ disabled, label, closeOnClick })}
      {...rest}
      role="menuitemradio"
      value={value}
      aria-checked={radio.value() === value}
    >
      {children}
    </button>
  );
}

function Separator(props: MenuSeparatorProps) {
  return <div {...props} role="separator" />;
}

/**
 * A menu of commands, checkbox and radio items and submenus, opened by a button. No JavaScript is
 * needed to open it: the trigger's `popovertarget` does, in server HTML too, and the client script
 * adds the APG keyboard contract. Unstyled: style the parts through `class` and native or ARIA
 * state (`:popover-open`, `[aria-expanded]`, `[aria-checked]`, `[aria-disabled]`,
 * `[data-highlighted]`).
 *
 * @example
 * <Menu.Root>
 *   <Menu.Trigger>Actions</Menu.Trigger>
 *   <Menu.Popup>
 *     <Menu.Item onClick={rename}>Rename</Menu.Item>
 *     <Menu.CheckboxItem bind:checked={pinned}>Pinned</Menu.CheckboxItem>
 *     <Menu.Separator />
 *     <Menu.Item disabled>Delete</Menu.Item>
 *   </Menu.Popup>
 * </Menu.Root>
 */
export const Menu = {
  Root,
  Trigger,
  Popup,
  Item,
  LinkItem,
  CheckboxItem,
  Separator,
  Group,
  GroupLabel,
  RadioGroup,
  RadioItem,
  SubmenuRoot,
  SubmenuTrigger,
};
