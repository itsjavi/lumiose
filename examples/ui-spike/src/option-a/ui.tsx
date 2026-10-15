// Option (a): the TASK-332 API as thin Lumiose components over @timelessui/components. They render
// Timeless's documented anatomy (`ui-*` hosts, `data-ui-part`, native dialog/popover/input), so the
// server HTML works before the elements upgrade; behaviour, ARIA and focus are Timeless's.
import "./elements.ts";
import { createContext, effect, ref, useContext, useId } from "lumiose";
import type {
  ComboboxItemProps,
  ComboboxRootProps,
  DialogRootProps,
  MenuCheckboxItemProps,
  MenuItemProps,
  MenuPopupProps,
  MenuRootProps,
} from "../api.ts";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "ui-dialog": JSX.HTMLProps<HTMLElement> & { kind?: "dialog" | "alert" };
      "ui-menu-button": JSX.HTMLProps<HTMLElement> & { placement?: string; open?: boolean };
      "ui-menu": JSX.HTMLProps<HTMLElement> & { orientation?: "vertical" | "horizontal" };
      "ui-combobox": JSX.HTMLProps<HTMLElement> & {
        value?: string;
        name?: string;
        required?: boolean;
        filter?: "contains" | "startsWith" | "none";
      };
    }
  }
}

type ButtonProps = JSX.IntrinsicElements["button"];

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

  // Controlled state. Timeless's ui-dialog has no `open` property, so this drives the native
  // dialog directly, which skips Timeless's own bookkeeping (the trigger's aria-expanded).
  effect(() => {
    const dialog = popup();
    const open = props.open;
    if (!dialog || open === undefined) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  return (
    <DialogContext value={context}>
      <ui-dialog kind={props.role === "alertdialog" ? "alert" : undefined}>
        {props.children}
      </ui-dialog>
    </DialogContext>
  );
}

function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error("Dialog parts must be inside <Dialog.Root>.");
  return context;
}

function DialogTrigger({ children, ...rest }: ButtonProps) {
  const dialog = useDialog();
  return (
    <button
      class="ui-button"
      data-ui-part="trigger"
      type="button"
      command="show-modal"
      commandfor={dialog.popupId}
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
      id={dialog.popupId}
      role={dialog.role()}
      aria-labelledby={dialog.titleId}
      aria-describedby={dialog.descriptionId}
      on:toggle={(event: ToggleEvent) => dialog.onOpenChange(event.newState === "open")}
      {...rest}
    >
      {children}
    </dialog>
  );
}

function DialogTitle({ children, ...rest }: JSX.IntrinsicElements["h2"]) {
  return (
    <h2 data-ui-part="title" id={useDialog().titleId} {...rest}>
      {children}
    </h2>
  );
}

function DialogDescription({ children, ...rest }: JSX.IntrinsicElements["p"]) {
  return (
    <p data-ui-part="description" id={useDialog().descriptionId} {...rest}>
      {children}
    </p>
  );
}

function DialogClose({ children, ...rest }: ButtonProps) {
  const dialog = useDialog();
  return (
    <button
      class="ui-button"
      data-ui-part="close"
      type="button"
      command="close"
      commandfor={dialog.popupId}
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

const MenuContext = createContext<{ popupId: string }>();

function MenuRoot(props: MenuRootProps) {
  const id = useId();
  const context = { popupId: `${id}-popup` };
  // `open` is a property of ui-menu-button: Lumiose sets it as one in the browser.
  return (
    <MenuContext value={context}>
      <ui-menu-button
        open={props.open}
        on:ui-open={() => props.onOpenChange?.(true)}
        on:ui-close={() => props.onOpenChange?.(false)}
      >
        {props.children}
      </ui-menu-button>
    </MenuContext>
  );
}

function useMenu() {
  const context = useContext(MenuContext);
  if (!context) throw new Error("Menu parts must be inside <Menu.Root>.");
  return context;
}

function MenuTrigger({ children, ...rest }: ButtonProps) {
  // `popovertarget` opens the menu with Enter, Space and clicks before the element upgrades.
  return (
    <button
      class="ui-button"
      data-ui-part="trigger"
      type="button"
      popovertarget={useMenu().popupId}
      {...rest}
    >
      {children}
    </button>
  );
}

function MenuPopup(props: MenuPopupProps) {
  const menu = useMenu();
  return (
    <ui-menu id={menu.popupId} role="menu" popover="auto" aria-label={props["aria-label"]}>
      {props.children}
    </ui-menu>
  );
}

function MenuItem(props: MenuItemProps) {
  // aria-disabled, not disabled: the APG keeps unavailable commands reachable with the arrows.
  // Timeless 0.2.0 leaves the menu open after an item runs (the APG closes it): the wrapper closes it.
  return (
    <button
      role="menuitem"
      type="button"
      aria-disabled={props.disabled || undefined}
      onClick={(event) => {
        if (props.disabled) return;
        props.onClick?.(event);
        const host = event.currentTarget.closest<HTMLElement & { open: boolean }>("ui-menu-button");
        if (host) host.open = false;
      }}
    >
      {props.children}
    </button>
  );
}

function MenuCheckboxItem(props: MenuCheckboxItemProps) {
  const item = ref<HTMLButtonElement>();
  // Timeless toggles aria-checked itself and reports it with `ui-change` on the menu, not the item.
  effect(() => {
    const element = item();
    const menu = element?.closest("ui-menu");
    if (!element || !menu) return;
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ checked: boolean; item: Element }>).detail;
      if (detail.item === element) props.onCheckedChange?.(detail.checked);
    };
    menu.addEventListener("ui-change", onChange);
    return () => menu.removeEventListener("ui-change", onChange);
  });
  return (
    <button
      ref={item}
      role="menuitemcheckbox"
      type="button"
      aria-checked={props.checked ?? false}
      aria-disabled={props.disabled || undefined}
    >
      {props.children}
    </button>
  );
}

function MenuSeparator() {
  return <hr data-ui-part="separator" role="separator" />;
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

const ComboboxContext = createContext<{ inputId: string; labelId: string; listId: string }>();

function ComboboxRoot(props: ComboboxRootProps) {
  const id = useId();
  const context = { inputId: `${id}-input`, labelId: `${id}-label`, listId: `${id}-list` };
  // `value` is a property of ui-combobox in the browser and its default-value attribute in the
  // server HTML, so one prop covers both.
  return (
    <ComboboxContext value={context}>
      <ui-combobox
        value={props.value ?? props.defaultValue}
        name={props.name}
        required={props.required}
        on:ui-change={(event: CustomEvent<{ value: string }>) =>
          props.onValueChange?.(event.detail.value)
        }
      >
        {props.children}
      </ui-combobox>
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
    <label id={combobox.labelId} for={combobox.inputId} {...rest}>
      {children}
    </label>
  );
}

function ComboboxInput(props: JSX.IntrinsicElements["input"]) {
  return (
    <input
      id={useCombobox().inputId}
      class="ui-input"
      role="combobox"
      type="text"
      autocomplete="off"
      aria-autocomplete="list"
      {...props}
    />
  );
}

function ComboboxList(props: { children?: JSX.Element }) {
  const combobox = useCombobox();
  return (
    <div
      id={combobox.listId}
      data-ui-part="listbox"
      role="listbox"
      popover="manual"
      aria-labelledby={combobox.labelId}
    >
      {props.children}
    </div>
  );
}

function ComboboxItem(props: ComboboxItemProps) {
  return (
    <div
      data-ui-part="option"
      role="option"
      data-ui-value={props.value}
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
