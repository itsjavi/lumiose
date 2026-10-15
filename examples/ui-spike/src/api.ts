// The component API both prototypes implement (TASK-332): Base UI's part names, React's controlled
// props (`open` + `onOpenChange`, `value` + `onValueChange`), native elements underneath. Option (a)
// renders Timeless's anatomy for @timelessui/components; option (b) renders the port's elements.
// The names are a proposal for the user (decision-32, decision-35).

export interface DialogRootProps {
  /** Controlled open state. Leave it out and the dialog keeps its own state. */
  open?: boolean;
  /** Called when the user opens or closes the dialog (trigger, close button, Escape). */
  onOpenChange?: (open: boolean) => void;
  /** `alertdialog` for a confirmation that needs an answer. */
  role?: "dialog" | "alertdialog";
  children?: JSX.Element;
}

export interface MenuRootProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
}

export interface MenuPopupProps {
  /** The accessible name of the menu. Defaults to the trigger's text. */
  "aria-label"?: string;
  children?: JSX.Element;
}

export interface MenuItemProps {
  /** Runs when the item is chosen with a click, Enter or Space. The menu closes afterwards. */
  onClick?: (event: MouseEvent) => void;
  disabled?: boolean;
  children?: JSX.Element;
}

export interface MenuCheckboxItemProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  children?: JSX.Element;
}

export interface ComboboxRootProps {
  /** Controlled value: the selected item's `value`. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Submits the selected value with a form under this name. */
  name?: string;
  required?: boolean;
  children?: JSX.Element;
}

export interface ComboboxItemProps {
  value: string;
  disabled?: boolean;
  children?: JSX.Element;
}
