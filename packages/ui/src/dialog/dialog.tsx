// Dialog and alert dialog (decision-62, TASK-355): a native modal <dialog> opened and closed by
// invoker commands, so it works in server HTML with no JavaScript. The dialog element is the only
// state: the trigger, a close button, Escape, a click on the backdrop and the `open` prop all end
// in its `toggle` event, the single source of `onOpenChange`. Ported from Timeless's approach
// (https://timeless.build); the keyboard contract is the platform's (APG Dialog pattern).
import { createContext, effect, ref, useContext, useId } from "lumiose";

export interface DialogRootProps {
  /**
   * Opens (`true`) or closes (`false`) the dialog when it changes, in the browser. Pair it with
   * `onOpenChange` to keep a signal in sync; leave both out and the dialog keeps its own state.
   * Server HTML always starts closed: a modal dialog only opens from script or a trigger.
   */
  open?: boolean;
  /** Called after the dialog opens or closes, whatever opened or closed it. */
  onOpenChange?: (open: boolean) => void;
  /**
   * `"alertdialog"` for a confirmation that needs an answer: a click outside does not close it
   * (Escape still does). Default `"dialog"`.
   */
  role?: "dialog" | "alertdialog";
  children?: JSX.Element;
}

/** A `<button>` that opens the dialog (`command="show-modal"`). */
export type DialogTriggerProps = JSX.IntrinsicElements["button"];
/** The `<dialog>`. `closedby` defaults to `"any"`, or `"closerequest"` for an alert dialog. */
export type DialogPopupProps = JSX.IntrinsicElements["dialog"];
/** The `<h2>` that names the dialog. */
export type DialogTitleProps = JSX.IntrinsicElements["h2"];
/** The `<p>` that describes the dialog. */
export type DialogDescriptionProps = JSX.IntrinsicElements["p"];
/** A `<button>` that closes the dialog (`command="close"`); its `value` becomes `returnValue`. */
export type DialogCloseProps = JSX.IntrinsicElements["button"];

interface DialogContextValue {
  popup: JSX.Ref<HTMLDialogElement>;
  role: () => "dialog" | "alertdialog";
  onOpenChange: (open: boolean) => void;
  popupId: string;
  titleId: string;
  descriptionId: string;
}

const DialogContext = createContext<DialogContextValue>();

function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) throw new Error("Dialog parts must be inside <Dialog.Root>.");
  return context;
}

function Root(props: DialogRootProps) {
  const popup = ref<HTMLDialogElement>();
  const id = useId();
  const context: DialogContextValue = {
    popup,
    role: () => props.role ?? "dialog",
    onOpenChange: (open) => props.onOpenChange?.(open),
    popupId: `${id}-popup`,
    titleId: `${id}-title`,
    descriptionId: `${id}-description`,
  };

  // The `open` prop drives the native state; the dialog's `toggle` event reports back, so a
  // signal written by `onOpenChange` sees the same value again and nothing loops.
  effect(() => {
    const dialog = popup();
    const open = props.open;
    if (!dialog?.isConnected || open === undefined) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  return <DialogContext value={context}>{props.children}</DialogContext>;
}

// Each part spreads the caller's props first, so they override the defaults (`type`, `closedby`,
// the label references), and sets the wiring last, so `id`, `command` and `commandfor` stay
// consistent between the parts.

function Trigger({ children, ...rest }: DialogTriggerProps) {
  const dialog = useDialog();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      {...rest}
      command="show-modal"
      commandfor={dialog.popupId}
    >
      {children}
    </button>
  );
}

function Popup({ children, ref: forwarded, ...rest }: DialogPopupProps) {
  const dialog = useDialog();
  const alert = () => dialog.role() === "alertdialog";
  return (
    <dialog
      role={alert() ? "alertdialog" : undefined}
      closedby={alert() ? "closerequest" : "any"}
      aria-labelledby={dialog.titleId}
      aria-describedby={dialog.descriptionId}
      {...rest}
      ref={(element: HTMLDialogElement) => {
        dialog.popup(element);
        forwarded?.(element);
      }}
      id={dialog.popupId}
      on:toggle={(event: ToggleEvent) => dialog.onOpenChange(event.newState === "open")}
    >
      {children}
    </dialog>
  );
}

function Title({ children, ...rest }: DialogTitleProps) {
  const dialog = useDialog();
  return (
    <h2 {...rest} id={dialog.titleId}>
      {children}
    </h2>
  );
}

function Description({ children, ...rest }: DialogDescriptionProps) {
  const dialog = useDialog();
  return (
    <p {...rest} id={dialog.descriptionId}>
      {children}
    </p>
  );
}

function Close({ children, ...rest }: DialogCloseProps) {
  const dialog = useDialog();
  return (
    <button type="button" {...rest} command="close" commandfor={dialog.popupId}>
      {children}
    </button>
  );
}

/**
 * A modal dialog, or an alert dialog with `role="alertdialog"` on `Root`. No JavaScript: the
 * native `<dialog>` and invoker commands do the work, in server HTML too. Unstyled: style the
 * parts through `class` and native state (`dialog[open]`, `::backdrop`).
 *
 * @example
 * <Dialog.Root role="alertdialog">
 *   <Dialog.Trigger>Delete project…</Dialog.Trigger>
 *   <Dialog.Popup>
 *     <Dialog.Title>Delete project?</Dialog.Title>
 *     <Dialog.Description>This removes the project and its deployments.</Dialog.Description>
 *     <Dialog.Close value="cancel">Cancel</Dialog.Close>
 *     <Dialog.Close value="delete">Delete</Dialog.Close>
 *   </Dialog.Popup>
 * </Dialog.Root>
 */
export const Dialog = { Root, Trigger, Popup, Title, Description, Close };
