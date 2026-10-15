// Dialog and alert dialog (decision-62, TASK-355): a native modal <dialog> opened and closed by
// invoker commands, so it works in server HTML with no JavaScript. The dialog element is the only
// state: the trigger, a close button, Escape, a click on the backdrop and the `open` prop all end
// in its `toggle` event, the single source of `onOpenChange`. Ported from Timeless's approach
// (https://timeless.build); the keyboard contract is the platform's (APG Dialog pattern).
import {
  createContext,
  effect,
  isServer,
  onCleanup,
  ref,
  signal,
  useContext,
  useId,
  type Signal,
} from "lumiose";

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
  /** Whether the dialog is open, as its last `toggle` event said. */
  open: Signal<boolean>;
  onToggle: (open: boolean) => void;
  popupId: string;
  titleId: string;
  descriptionId: string;
  /** How many Title and Description parts are rendered: the popup references only those. */
  titles: Signal<number>;
  descriptions: Signal<number>;
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
  const open = signal(false);
  const context: DialogContextValue = {
    popup,
    role: () => props.role ?? "dialog",
    open,
    onToggle: (next) => {
      open.set(next);
      props.onOpenChange?.(next);
    },
    popupId: `${id}-popup`,
    titleId: `${id}-title`,
    descriptionId: `${id}-description`,
    titles: signal(0),
    descriptions: signal(0),
  };

  // The `open` prop drives the native state; the dialog's `toggle` event reports back, so a
  // signal written by `onOpenChange` sees the same value again and nothing loops.
  effect(() => {
    const dialog = popup();
    const wanted = props.open;
    if (!dialog?.isConnected || wanted === undefined) return;
    if (wanted && !dialog.open) dialog.showModal();
    else if (!wanted && dialog.open) dialog.close();
  });

  return <DialogContext value={context}>{props.children}</DialogContext>;
}

// Each part spreads the caller's props first, so they override the defaults (`type`, `closedby`,
// the label references), and sets the wiring last, so `id`, `command` and `commandfor` stay
// consistent between the parts.

function Trigger({ children, ...rest }: DialogTriggerProps) {
  const dialog = useDialog();
  // While the modal dialog is open the trigger is inert, so the server's "false" is never wrong
  // where assistive technology can reach it; in the browser it follows the dialog.
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={dialog.open()}
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
  // The server writes the attributes before it renders the children, so it renders them first to
  // know which Title and Description exist. The browser claims the dialog before its children
  // (hydration needs that order) and updates the references when the parts register.
  const content = isServer ? children : undefined;
  return (
    <dialog
      role={alert() ? "alertdialog" : undefined}
      closedby={alert() ? "closerequest" : "any"}
      aria-labelledby={dialog.titles() > 0 ? dialog.titleId : undefined}
      aria-describedby={dialog.descriptions() > 0 ? dialog.descriptionId : undefined}
      {...rest}
      ref={(element: HTMLDialogElement) => {
        dialog.popup(element);
        forwarded?.(element);
      }}
      id={dialog.popupId}
      on:toggle={(event: ToggleEvent) => dialog.onToggle(event.newState === "open")}
    >
      {isServer ? content : children}
    </dialog>
  );
}

/** Counts a rendered part in `count` while it is mounted. */
function register(count: Signal<number>) {
  count.update((n) => n + 1);
  onCleanup(() => count.update((n) => n - 1));
}

function Title({ children, ...rest }: DialogTitleProps) {
  const dialog = useDialog();
  register(dialog.titles);
  return (
    <h2 {...rest} id={dialog.titleId}>
      {children}
    </h2>
  );
}

function Description({ children, ...rest }: DialogDescriptionProps) {
  const dialog = useDialog();
  register(dialog.descriptions);
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
