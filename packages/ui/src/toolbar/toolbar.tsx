// Toolbar (decision-62, TASK-383): a row (or column) of controls with one tab stop, after Base UI's
// Toolbar and the APG toolbar pattern. Root renders `<lu-toolbar role="toolbar">`, whose script
// (toolbar.script.ts) moves focus between the items with the arrow keys, Home and End, following
// the orientation and the direction. The items are native: Button is a `<button>` that stays
// focusable when disabled (`aria-disabled`), Link an `<a>`, Input an `<input>`; a ToggleGroup's
// toggles inside a toolbar are its items too. In the server HTML every item is a tab stop, so all
// are reachable before the script (or without it); the script makes them one (TASK-437 M12).
// `disabled` reaches every item but links: Menu and Popover triggers and Toggles render
// `aria-disabled`, and button.script.ts cancels their clicks (TASK-437 M13).
import { useContext } from "lumiose";
import { Button, type ButtonProps } from "../button/button.tsx";
import buttonScript from "../button/button.script.ts?client";
import { Separator, type SeparatorProps } from "../separator/separator.tsx";
import { ToolbarContext, type ToolbarContextValue } from "./context.ts";
import type { ToolbarElement } from "./toolbar.script.ts";
import toolbarScript from "./toolbar.script.ts?client";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * Toolbar's element: `role="toolbar"`, with `data-orientation` and `data-loop-focus`
       * (`"false"` stops focus at the ends).
       */
      "lu-toolbar": JSX.HTMLProps<ToolbarElement>;
    }
  }
}

/** `Toolbar.Root` renders `<lu-toolbar role="toolbar">` around the items. */
export type ToolbarRootProps = JSX.HTMLProps<ToolbarElement> & {
  /** A row (`"horizontal"`, default) moved through with Left and Right, or a column with Up and Down. */
  orientation?: "horizontal" | "vertical";
  /** The arrow keys go from the last item to the first, and back. Default `true`. */
  loopFocus?: boolean;
  /** Disables every item; they stay focusable (`aria-disabled`). */
  disabled?: boolean;
};

/**
 * A `<button>` item: a [Button](button.md) that, disabled, stays focusable (`aria-disabled`) unless
 * `focusableWhenDisabled` is `false`.
 */
export type ToolbarButtonProps = ButtonProps;

/** An `<a>` item. */
export type ToolbarLinkProps = JSX.IntrinsicElements["a"];

/** An `<input>` item: Left and Right move its caret, and focus moves on at its start or end. */
export type ToolbarInputProps = JSX.IntrinsicElements["input"] & {
  /** Disabled, it stays focusable (`aria-disabled` and read-only). Default `true`. */
  focusableWhenDisabled?: boolean;
};

/** A `<div role="group">` of items, which `disabled` disables together. */
export type ToolbarGroupProps = JSX.IntrinsicElements["div"] & {
  /** Disables the group's items; they stay focusable. */
  disabled?: boolean;
};

/** A [Separator](separator.md) between items: across the toolbar (vertical in a row) by default. */
export type ToolbarSeparatorProps = SeparatorProps;

function useToolbar(part: string): ToolbarContextValue {
  const context = useContext(ToolbarContext);
  if (!context) throw new Error(`Toolbar.${part} must be inside <Toolbar.Root>.`);
  return context;
}

function Root({ orientation, loopFocus, disabled, children, ...rest }: ToolbarRootProps) {
  // The arrow keys and the single tab stop, on server pages and in islands (decision-63).
  toolbarScript();
  // Cancels the clicks of its `aria-disabled` items, Menu and Popover triggers and Toggles included.
  buttonScript();
  const context: ToolbarContextValue = {
    orientation: () => orientation ?? "horizontal",
    disabled: () => disabled === true,
  };
  return (
    <ToolbarContext value={context}>
      <lu-toolbar
        {...rest}
        role="toolbar"
        aria-orientation={context.orientation()}
        data-orientation={context.orientation()}
        data-loop-focus={loopFocus === false ? "false" : undefined}
        data-disabled={context.disabled() ? "" : undefined}
      >
        {children}
      </lu-toolbar>
    </ToolbarContext>
  );
}

function ToolbarButton({ disabled, focusableWhenDisabled, children, ...rest }: ToolbarButtonProps) {
  const toolbar = useToolbar("Button");
  return (
    <Button
      {...rest}
      disabled={disabled === true || toolbar.disabled()}
      focusableWhenDisabled={focusableWhenDisabled ?? true}
      data-orientation={toolbar.orientation()}
    >
      {children}
    </Button>
  );
}

function Link({ children, ...rest }: ToolbarLinkProps) {
  const toolbar = useToolbar("Link");
  return (
    <a {...rest} data-orientation={toolbar.orientation()}>
      {children}
    </a>
  );
}

function Input({ disabled, focusableWhenDisabled, ...rest }: ToolbarInputProps) {
  const toolbar = useToolbar("Input");
  const off = () => disabled === true || toolbar.disabled();
  const soft = () => off() && focusableWhenDisabled !== false;
  return (
    <input
      {...rest}
      disabled={off() && !soft()}
      readonly={soft() || rest.readonly}
      aria-disabled={soft() ? "true" : rest["aria-disabled"]}
      data-orientation={toolbar.orientation()}
    />
  );
}

function Group({ disabled, children, ...rest }: ToolbarGroupProps) {
  const toolbar = useToolbar("Group");
  const context: ToolbarContextValue = {
    ...toolbar,
    disabled: () => disabled === true || toolbar.disabled(),
  };
  return (
    <ToolbarContext value={context}>
      <div
        {...rest}
        role="group"
        data-orientation={toolbar.orientation()}
        data-disabled={context.disabled() ? "" : undefined}
      >
        {children}
      </div>
    </ToolbarContext>
  );
}

function ToolbarSeparator({ orientation, ...rest }: ToolbarSeparatorProps) {
  const toolbar = useToolbar("Separator");
  // Across the toolbar: a vertical line in a row, a horizontal one in a column.
  const across = () => (toolbar.orientation() === "horizontal" ? "vertical" : "horizontal");
  return <Separator {...rest} orientation={orientation ?? across()} />;
}

/**
 * A set of controls with one tab stop: the arrow keys move between them, Home and End go to the
 * ends, following the orientation and the direction. Buttons, links, inputs and ToggleGroups
 * inside it are its items. Unstyled: style the parts through `class`, `[data-orientation]`,
 * `[aria-disabled="true"]` and `:focus-visible`.
 *
 * @example
 * <Toolbar.Root aria-label="Formatting">
 *   <Toolbar.Button>Bold</Toolbar.Button>
 *   <Toolbar.Separator />
 *   <Toolbar.Link href="/help">Help</Toolbar.Link>
 * </Toolbar.Root>
 */
export const Toolbar = {
  Root,
  Button: ToolbarButton,
  Link,
  Input,
  Group,
  Separator: ToolbarSeparator,
};
