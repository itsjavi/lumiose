// Context Menu (decision-62, TASK-378): Menu, opened at the pointer by a right-click in its trigger
// area, a long press on a touch screen, or Shift+F10 and the ContextMenu key. Root renders
// `<lu-context-menu>` (./context-menu.script.ts) around the area and the menu; Popup renders
// Menu's `<lu-menu>` and `Menu.Popup`, anchored to a zero-size element that the script moves to
// the pointer; the items are Menu's parts, with Menu's keys, typeahead, submenus and dismissal.
// A right-click needs the script: without JavaScript the browser shows its own menu.
import {
  createContext,
  effect,
  ref,
  signal,
  untrack,
  useContext,
  useId,
  type Signal,
} from "lumiose";
import { Menu, MenuContext, type MenuContextValue, type MenuPopupProps } from "../menu/menu.tsx";
import type { MenuElement, MenuOpenChangeDetail } from "../menu/menu.script.ts";
import { anchorName } from "../placement/placement.ts";
import contextMenuScript from "./context-menu.script.ts?client";
import type { ContextMenuElement } from "./context-menu.script.ts";
import { batched } from "../batched.ts";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /** ContextMenu.Root's element: it opens its menu on a right-click, long press or key. */
      "lu-context-menu": JSX.HTMLProps<ContextMenuElement>;
    }
  }
}

/**
 * `ContextMenu.Root` renders `<lu-context-menu>`, an element with no box around the trigger area
 * and the menu. `bind:open={signal}` stands in for `open` and `onOpenChange`.
 */
export interface ContextMenuRootProps {
  /**
   * Opens (`true`) or closes (`false`) the menu when it changes, in the browser, at the last place
   * it opened (the top start corner of the window at first). Pair it with `onOpenChange` to keep a
   * signal in sync; leave both out and the menu keeps its own state.
   */
  open?: boolean;
  /** Called after the menu opens or closes, whatever opened or closed it. */
  onOpenChange?: (open: boolean) => void;
  /** The trigger area keeps the browser's own menu. */
  disabled?: boolean;
  /** The other parts: the `ContextMenu.Trigger` and the `ContextMenu.Popup`. */
  children?: JSX.Element;
}

/**
 * The `<div>` area whose right-click, long press, Shift+F10 or ContextMenu key opens the menu. For
 * the keys, focus must be in it: give it `tabindex={0}`, or focusable content.
 */
export type ContextMenuTriggerProps = JSX.IntrinsicElements["div"];

/**
 * The `<div role="menu" popover>` of items: Menu's popup, placed at the pointer. Its placement
 * props work from that point (default `side="bottom"`, `align="start"`, `sideOffset={0}`). Inside
 * a `SubmenuRoot` it is the submenu's popup, placed next to its trigger.
 */
export type ContextMenuPopupProps = MenuPopupProps;

interface ContextMenuContextValue {
  menu: MenuContextValue;
  host: (element: MenuElement) => void;
  onOpenChange: (open: boolean) => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue>();

function useContextMenu(): ContextMenuContextValue {
  const context = useContext(ContextMenuContext);
  if (!context) throw new Error("ContextMenu parts must be inside <ContextMenu.Root>.");
  return context;
}

function Root(props: ContextMenuRootProps) {
  // Right-click, long press and the keys; Menu's script comes with it (decision-63).
  contextMenuScript();
  const id = useId();
  const host = ref<MenuElement>();
  const menu: MenuContextValue = {
    popupId: `${id}-popup`,
    triggerId: `${id}-trigger`,
    id,
    submenu: false,
    triggers: signal(0) as Signal<number>,
  };

  // The `open` prop drives the menu; its `openchange` event reports back (as Menu.Root).
  effect(() => {
    const element = host();
    const wanted = props.open;
    if (!element?.isConnected || wanted === undefined) return;
    if (wanted) element.show(false);
    else element.open = false;
  });

  return (
    <ContextMenuContext
      value={{
        menu,
        host,
        onOpenChange: (open) => untrack(() => props.onOpenChange?.(open)),
      }}
    >
      <MenuContext value={menu}>
        <lu-context-menu data-disabled={props.disabled ? "" : undefined}>
          {props.children}
        </lu-context-menu>
      </MenuContext>
    </ContextMenuContext>
  );
}

function Trigger({ children, ...rest }: ContextMenuTriggerProps) {
  useContextMenu();
  return <div {...rest}>{children}</div>;
}

function Popup(props: ContextMenuPopupProps) {
  const context = useContextMenu();
  // In a submenu, a submenu's popup: placed next to its trigger, as in Menu.
  if (useContext(MenuContext)?.submenu) return <Menu.Popup {...props} />;
  return (
    <lu-menu
      ref={context.host}
      on:openchange={batched((event: CustomEvent<MenuOpenChangeDetail>) =>
        context.onOpenChange(event.detail.open),
      )}
    >
      {/* The point the popup is anchored to: the script moves it to the pointer. */}
      <span
        aria-hidden="true"
        style={{
          position: "fixed",
          "inset-inline-start": "var(--lu-context-x, 0)",
          "inset-block-start": "var(--lu-context-y, 0)",
          "anchor-name": anchorName(context.menu.id),
        }}
      />
      {/* At the pointer itself: no gap, unless the props ask for one. */}
      <Menu.Popup {...props} sideOffset={props.sideOffset ?? 0} />
    </lu-menu>
  );
}

/**
 * A menu opened at the pointer by a right-click in its trigger area, a long press on a touch
 * screen, or Shift+F10 and the ContextMenu key with focus in it. Its items are Menu's: commands,
 * links, checkbox and radio items, groups, separators and submenus, with Menu's keys and
 * dismissal. Unstyled: style the popup as a Menu's (the default theme's `lu-menu`).
 *
 * @example
 * <ContextMenu.Root>
 *   <ContextMenu.Trigger tabindex={0}>Right-click here</ContextMenu.Trigger>
 *   <ContextMenu.Popup>
 *     <ContextMenu.Item>Copy</ContextMenu.Item>
 *     <ContextMenu.Item>Paste</ContextMenu.Item>
 *   </ContextMenu.Popup>
 * </ContextMenu.Root>
 */
export const ContextMenu = {
  Root,
  Trigger,
  Popup,
  Item: Menu.Item,
  LinkItem: Menu.LinkItem,
  CheckboxItem: Menu.CheckboxItem,
  RadioGroup: Menu.RadioGroup,
  RadioItem: Menu.RadioItem,
  Group: Menu.Group,
  GroupLabel: Menu.GroupLabel,
  Separator: Menu.Separator,
  SubmenuRoot: Menu.SubmenuRoot,
  SubmenuTrigger: Menu.SubmenuTrigger,
};
