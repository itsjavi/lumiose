// Menubar (decision-62, TASK-379): a row of Menus, after Base UI's Menubar and the WAI-ARIA
// menubar pattern. It renders `<lu-menubar role="menubar">` (./menubar.script.ts) around
// `Menu.Root`s: inside it, each top-level `<lu-menu>` is `role="none"` and its `Menu.Trigger` a
// `role="menuitem"`, so the bar's items are the triggers, as in the APG example. Menu's script runs
// each menu (keys, items, submenus, dismissal); the menubar's adds one tab stop for the bar, the
// arrow keys between its items and between open menus, and hover switching once a menu is open.
// Without JavaScript every trigger is a tab stop that opens its popover.
import { MenubarContext } from "../menu/menu.tsx";
import menubarScript from "./menubar.script.ts?client";
import type { MenubarElement } from "./menubar.script.ts";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /** Menubar's element: a `role="menubar"` that moves focus between its menus' triggers. */
      "lu-menubar": JSX.HTMLProps<MenubarElement>;
    }
  }
}

/** Which way a menubar's items run. */
export type MenubarOrientation = "horizontal" | "vertical";

/** `Menubar` renders `<lu-menubar role="menubar">` around `Menu.Root`s. */
export type MenubarProps = JSX.IntrinsicElements["lu-menubar"] & {
  /**
   * Which way the items run: `"vertical"` stacks them, moves between them with Arrow Up and Down,
   * opens a menu with the arrow that points at its popup, and places popups at the inline end.
   * Default `"horizontal"`.
   */
  orientation?: MenubarOrientation;
  /** Whether the arrow keys wrap from the last item to the first and back. Default `true`. */
  loopFocus?: boolean;
};

/**
 * A bar of menus, such as an app's File, Edit and View: put `Menu.Root`s inside, each with its
 * `Menu.Trigger` and `Menu.Popup`. Give it an `aria-label`.
 *
 * @example
 * <Menubar aria-label="Editor">
 *   <Menu.Root>
 *     <Menu.Trigger>File</Menu.Trigger>
 *     <Menu.Popup>
 *       <Menu.Item>New</Menu.Item>
 *     </Menu.Popup>
 *   </Menu.Root>
 * </Menubar>
 */
export function Menubar({ orientation, loopFocus, children, ...rest }: MenubarProps) {
  // The bar's keys and hover switching; the page loads it once (decision-63).
  menubarScript();
  const vertical = () => orientation === "vertical";
  return (
    <MenubarContext value={{ orientation: vertical() ? "vertical" : "horizontal" }}>
      <lu-menubar
        {...rest}
        role="menubar"
        aria-orientation={vertical() ? "vertical" : "horizontal"}
        data-orientation={vertical() ? "vertical" : "horizontal"}
        data-loop-focus={loopFocus === false ? "false" : undefined}
      >
        {children}
      </lu-menubar>
    </MenubarContext>
  );
}
