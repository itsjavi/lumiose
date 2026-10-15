// Option (b): the TASK-332 API on the port. Native elements carry the state (<dialog>, popover,
// invoker commands, CSS anchor positioning wired in the server HTML); `lu-menu` and `lu-combobox`
// add only the keyboard and selection logic the platform lacks. A dialog is plain markup.
import "./elements.ts";
import { createContext, effect, ref, untrack, useContext, useId } from "lumiose";
import type {
  ComboboxItemProps,
  ComboboxRootProps,
  DialogRootProps,
  MenuCheckboxItemProps,
  MenuItemProps,
  MenuPopupProps,
  MenuRootProps,
} from "../api.ts";
import type { ComboboxElement } from "./combobox.element.ts";
import type { MenuCheckedChangeDetail, MenuOpenChangeDetail } from "./menu.element.ts";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /** Properties: `open`. Events: `openchange`. Items dispatch `checkedchange`. */
      "lu-menu": JSX.HTMLProps<HTMLElement> & { open?: boolean };
      /** Properties: `value`, `name`, `required`. Events: `change`. */
      "lu-combobox": JSX.HTMLProps<HTMLElement> & {
        value?: string;
        name?: string;
        required?: boolean;
      };
    }
  }
}

// Dialog -----------------------------------------------------------------------------------------

const DialogContext = createContext<{
  popup: JSX.Ref<HTMLDialogElement>;
  role: () => "dialog" | "alertdialog";
  onOpenChange: (open: boolean) => void;
  popupId: string;
  titleId: string;
  descriptionId: string;
}>();

function DialogRoot(props: DialogRootProps) {
  const popup = ref<HTMLDialogElement>();
  const id = useId();
  const context = {
    popup,
    role: () => props.role ?? "dialog",
    onOpenChange: (open: boolean) => props.onOpenChange?.(open),
    popupId: `${id}-popup`,
    titleId: `${id}-title`,
    descriptionId: `${id}-description`,
  };

  // Controlled state. The native dialog is the only state: opening it from here, from the trigger's
  // invoker command or closing it with Escape all end in the same `toggle` event.
  effect(() => {
    const dialog = popup();
    const open = props.open;
    if (!dialog || open === undefined) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  return <DialogContext value={context}>{props.children}</DialogContext>;
}

function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error("Dialog parts must be inside <Dialog.Root>.");
  return context;
}

function DialogTrigger({ children, ...rest }: JSX.IntrinsicElements["button"]) {
  const dialog = useDialog();
  return (
    <button
      class="lu-button"
      type="button"
      command="show-modal"
      commandfor={dialog.popupId}
      aria-haspopup="dialog"
      {...rest}
    >
      {children}
    </button>
  );
}

function DialogPopup({ children, ...rest }: JSX.IntrinsicElements["dialog"]) {
  const dialog = useDialog();
  return (
    <dialog
      ref={dialog.popup}
      class="lu-dialog"
      id={dialog.popupId}
      role={dialog.role()}
      aria-labelledby={dialog.titleId}
      aria-describedby={dialog.descriptionId}
      closedby={dialog.role() === "alertdialog" ? "closerequest" : "any"}
      on:toggle={(event: ToggleEvent) => dialog.onOpenChange(event.newState === "open")}
      {...rest}
    >
      {children}
    </dialog>
  );
}

function DialogTitle({ children, ...rest }: JSX.IntrinsicElements["h2"]) {
  return (
    <h2 id={useDialog().titleId} {...rest}>
      {children}
    </h2>
  );
}

function DialogDescription({ children, ...rest }: JSX.IntrinsicElements["p"]) {
  return (
    <p id={useDialog().descriptionId} {...rest}>
      {children}
    </p>
  );
}

function DialogClose({ children, ...rest }: JSX.IntrinsicElements["button"]) {
  return (
    <button
      class="lu-button"
      type="button"
      command="close"
      commandfor={useDialog().popupId}
      {...rest}
    >
      {children}
    </button>
  );
}

export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Popup: DialogPopup,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
};

// Menu -------------------------------------------------------------------------------------------

const MenuContext = createContext<{ popupId: string; anchor: string }>();

function MenuRoot(props: MenuRootProps) {
  const id = useId();
  const context = { popupId: `${id}-popup`, anchor: `--${id}` };
  // `open` is a property of lu-menu: Lumiose sets it as one in the browser.
  return (
    <MenuContext value={context}>
      <lu-menu
        open={props.open}
        on:openchange={(event: CustomEvent<MenuOpenChangeDetail>) =>
          props.onOpenChange?.(event.detail.open)
        }
      >
        {props.children}
      </lu-menu>
    </MenuContext>
  );
}

function useMenu() {
  const context = useContext(MenuContext);
  if (!context) throw new Error("Menu parts must be inside <Menu.Root>.");
  return context;
}

function MenuTrigger({ children, ...rest }: JSX.IntrinsicElements["button"]) {
  const menu = useMenu();
  // `popovertarget` opens the menu with clicks, Enter and Space before lu-menu is defined, and the
  // anchor name places it with CSS anchor positioning: no script positions anything.
  return (
    <button
      class="lu-button"
      type="button"
      popovertarget={menu.popupId}
      aria-haspopup="menu"
      aria-controls={menu.popupId}
      aria-expanded="false"
      style={{ "anchor-name": menu.anchor }}
      {...rest}
    >
      {children}
    </button>
  );
}

function MenuPopup(props: MenuPopupProps) {
  const menu = useMenu();
  return (
    <div
      class="lu-popup lu-menu-popup"
      id={menu.popupId}
      role="menu"
      popover="auto"
      aria-label={props["aria-label"]}
      style={{ "position-anchor": menu.anchor }}
    >
      {props.children}
    </div>
  );
}

function MenuItem(props: MenuItemProps) {
  // aria-disabled, not disabled: the APG keeps unavailable commands reachable with the arrows.
  return (
    <button
      class="lu-menu-item"
      role="menuitem"
      type="button"
      tabindex="-1"
      aria-disabled={props.disabled || undefined}
      onClick={(event) => props.onClick?.(event)}
    >
      {props.children}
    </button>
  );
}

function MenuCheckboxItem(props: MenuCheckboxItemProps) {
  return (
    <button
      class="lu-menu-item"
      role="menuitemcheckbox"
      type="button"
      tabindex="-1"
      aria-checked={props.checked ?? false}
      aria-disabled={props.disabled || undefined}
      on:checkedchange={(event: CustomEvent<MenuCheckedChangeDetail>) =>
        props.onCheckedChange?.(event.detail.checked)
      }
    >
      {props.children}
    </button>
  );
}

function MenuSeparator() {
  return <div class="lu-separator" role="separator" />;
}

export const Menu = {
  Root: MenuRoot,
  Trigger: MenuTrigger,
  Popup: MenuPopup,
  Item: MenuItem,
  CheckboxItem: MenuCheckboxItem,
  Separator: MenuSeparator,
};

// Combobox ---------------------------------------------------------------------------------------

const ComboboxContext = createContext<{
  value: () => string | undefined;
  inputId: string;
  labelId: string;
  listId: string;
  anchor: string;
}>();

function ComboboxRoot(props: ComboboxRootProps) {
  const id = useId();
  const context = {
    value: () => props.value ?? props.defaultValue,
    inputId: `${id}-input`,
    labelId: `${id}-label`,
    listId: `${id}-list`,
    anchor: `--${id}`,
  };
  // `value` is a property of lu-combobox in the browser and an attribute in the server HTML. Its
  // `change` event fires only for a new selection, so the pair is all a two-way binding needs.
  return (
    <ComboboxContext value={context}>
      <lu-combobox
        value={props.value ?? props.defaultValue}
        name={props.name}
        required={props.required}
        on:change={(event: Event) =>
          props.onValueChange?.((event.currentTarget as ComboboxElement).value)
        }
      >
        {props.children}
      </lu-combobox>
    </ComboboxContext>
  );
}

function useCombobox() {
  const context = useContext(ComboboxContext);
  if (!context) throw new Error("Combobox parts must be inside <Combobox.Root>.");
  return context;
}

function ComboboxLabel({ children, ...rest }: JSX.IntrinsicElements["label"]) {
  const combobox = useCombobox();
  return (
    <label class="lu-label" id={combobox.labelId} for={combobox.inputId} {...rest}>
      {children}
    </label>
  );
}

function ComboboxInput(props: JSX.IntrinsicElements["input"]) {
  const combobox = useCombobox();
  return (
    <input
      class="lu-input"
      id={combobox.inputId}
      role="combobox"
      type="text"
      autocomplete="off"
      aria-autocomplete="list"
      aria-expanded="false"
      aria-controls={combobox.listId}
      style={{ "anchor-name": combobox.anchor }}
      {...props}
    />
  );
}

function ComboboxList(props: { children?: JSX.Element }) {
  const combobox = useCombobox();
  return (
    <div
      class="lu-popup lu-listbox"
      id={combobox.listId}
      role="listbox"
      popover="manual"
      aria-labelledby={combobox.labelId}
      style={{ "position-anchor": combobox.anchor }}
    >
      {props.children}
    </div>
  );
}

function ComboboxItem(props: ComboboxItemProps) {
  const combobox = useCombobox();
  // The server marks the initial selection; in the browser lu-combobox owns aria-selected.
  const selected = untrack(() => combobox.value() === props.value);
  return (
    <div
      class="lu-option"
      id={useId()}
      role="option"
      data-value={props.value}
      aria-selected={selected}
      aria-disabled={props.disabled || undefined}
    >
      {props.children}
    </div>
  );
}

export const Combobox = {
  Root: ComboboxRoot,
  Label: ComboboxLabel,
  Input: ComboboxInput,
  List: ComboboxList,
  Item: ComboboxItem,
};
