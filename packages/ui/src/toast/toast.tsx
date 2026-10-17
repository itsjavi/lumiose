// Toast (decision-62, TASK-371): Viewport renders `<lu-toast-viewport>`, a light-DOM element whose
// script (toast.script.ts) gives every toast inside it Base UI's behaviour: the top layer, timers
// that pause on hover and focus, the limit, swipe to dismiss, F6, and announcements. What renders
// the toasts is up to the page:
//
// - Server HTML: a page renders `Toast.Root` with a plain object (`toast={{ title: "Saved" }}`),
//   for a form action's result. It shows without JavaScript; the script then times and closes it.
// - An island: a toast manager (`Toast.createToastManager()`, shared through a module) adds,
//   updates and closes toasts, and the island maps `manager.toasts()` to `Toast.Root`s. The
//   manager keeps each toast's object stable and its fields reactive, so an update changes the
//   toast in place; a close runs its exit animation, then the manager removes it.
//
// Ported from Timeless's approach (https://timeless.build).
import { createContext, effect, ref, signal, untrack, useContext, useId } from "lumiose";
import { afterAnimations } from "../animation/animation.ts";
import toastScript from "./toast.script.ts?client";
import { CLOSE_COMMAND } from "./command.ts";
import type { LuToastViewport } from "./toast.script.ts";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /** Toast.Viewport's element: the toasts' region, in the top layer. */
      "lu-toast-viewport": JSX.HTMLProps<LuToastViewport>;
    }
  }
}

/** What a toast shows and how it behaves: the options of `add` and `update`. */
export interface ToastOptions {
  /** An id of your own, to update or close the toast later. Default: one the manager makes. */
  id?: string;
  /** Its title, shown by `Toast.Title`. */
  title?: string;
  /** Its description, shown by `Toast.Description`. */
  description?: string;
  /** A type of your own (`"success"`, `"error"`, `"loading"`): its `data-type`, for styling. */
  type?: string;
  /**
   * Milliseconds before it closes on its own; `0` keeps it until closed. Default: the provider's
   * `timeout`, 5000. Keep toasts with an action or with something to read twice open (`0`).
   */
  timeout?: number;
  /**
   * `"high"` announces it at once (`role="alert"`), for errors that need attention; default
   * `"low"`, announced when the reader is idle (`role="status"`).
   */
  priority?: "low" | "high";
  /**
   * The props of its `Toast.Action` button: `children` for the label, `onClick`, `class`,
   * `disabled` and `aria-*`. Other keys are dropped: the options may be a payload as it arrived.
   */
  actionProps?: JSX.IntrinsicElements["button"];
  /** Called when it starts closing. */
  onClose?: () => void;
  /** Called once it is removed, after its exit animation. */
  onRemove?: () => void;
}

/** A toast, as a manager lists it: its options, with an id, read reactively. */
export interface ToastObject extends ToastOptions {
  id: string;
  /** `"ending"` while it closes: its exit animation runs, then the manager removes it. */
  transitionStatus?: "ending";
}

/** A promise toast's options in each state: options, a title, or a function of the result. */
export interface ToastPromiseOptions<T> {
  /** While the promise runs: the toast stays (`timeout: 0`) with `type: "loading"`. */
  loading: ToastOptions | string;
  /** Once it resolves, with `type: "success"` and the default timeout. */
  success: ToastOptions | string | ((value: T) => ToastOptions | string);
  /** Once it rejects, with `type: "error"` and the default timeout. */
  error: ToastOptions | string | ((error: unknown) => ToastOptions | string);
}

/** Adds, updates and closes toasts: share one through a module between islands. */
export interface ToastManager {
  /** The open toasts, newest first: map them to `Toast.Root`s inside `Toast.Viewport`. */
  toasts(): readonly ToastObject[];
  /** Adds a toast and returns its id. With the id of an open toast, it updates that one in place. */
  add(options: ToastOptions): string;
  /** Changes an open toast in place. */
  update(id: string, options: Partial<ToastOptions>): void;
  /** Closes a toast, or every toast without an id. */
  close(id?: string): void;
  /**
   * Shows a loading toast while `promise` runs (it stays), then turns it into a success or an
   * error toast. Returns `promise`.
   */
  promise<T>(promise: Promise<T>, options: ToastPromiseOptions<T>): Promise<T>;
}

/** `Toast.Provider` holds the defaults of its toasts and a manager for `Toast.useToastManager`. */
export interface ToastProviderProps {
  /** The manager its islands share. Default: a new one. */
  toastManager?: ToastManager;
  /** Milliseconds before a toast closes on its own. Default `5000`; `0` keeps toasts open. */
  timeout?: number;
  /** How many toasts show at once; older ones wait, hidden. Default `3`. */
  limit?: number;
  /** The `Toast.Viewport` and whatever adds toasts: the provider renders no element. */
  children?: JSX.Element;
}

/**
 * The toasts' region: `<lu-toast-viewport role="region">`, in the top layer. Name it with
 * `aria-label` (default "Notifications (F6)").
 */
export type ToastViewportProps = JSX.HTMLProps<LuToastViewport>;

/** A toast: a `<div role="status">`, or `role="alert"` for a high-priority one. */
export type ToastRootProps = JSX.IntrinsicElements["div"] & {
  /** The toast: one from a manager, or a plain object in server HTML. */
  toast: ToastObject | (ToastOptions & { id?: string });
  /**
   * The directions a swipe closes it in. Default `["down", "right"]`; `[]` turns swiping off.
   */
  swipeDirection?: ("up" | "down" | "left" | "right")[];
};
/** A `<div>` around the toast's text and buttons. */
export type ToastContentProps = JSX.IntrinsicElements["div"];
/** The toast's `<h2>`: its children, or else the toast's `title`. */
export type ToastTitleProps = JSX.IntrinsicElements["h2"];
/** The toast's `<p>`: its children, or else the toast's `description`. */
export type ToastDescriptionProps = JSX.IntrinsicElements["p"];
/** A `<button>` for the toast's action, with the toast's `actionProps`; nothing without them. */
export type ToastActionProps = JSX.IntrinsicElements["button"];
/** A `<button>` that closes the toast. Name it, with text or `aria-label`. */
export type ToastCloseProps = JSX.IntrinsicElements["button"];

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_LIMIT = 3;

interface ManagedToast {
  record: ToastObject;
  set: (options: Partial<ToastObject>) => void;
}

/** The manager of each managed toast, and its removal. */
const owners = new WeakMap<object, { remove: (id: string) => void; close: (id: string) => void }>();

const FIELDS = [
  "title",
  "description",
  "type",
  "timeout",
  "priority",
  "actionProps",
  "onClose",
  "onRemove",
  "transitionStatus",
] as const;

/** A toast object whose fields read a signal, so the parts that show them update in place. */
function managed(id: string, options: ToastOptions): ManagedToast {
  const state = signal<Partial<ToastObject>>({ ...options });
  const record = { id } as ToastObject;
  for (const field of FIELDS) {
    Object.defineProperty(record, field, { enumerable: true, get: () => state()[field] });
  }
  return { record, set: (next) => state.set({ ...state(), ...next }) };
}

const asOptions = (value: ToastOptions | string): ToastOptions =>
  typeof value === "string" ? { title: value } : value;

let managers = 0;

/**
 * Makes a toast manager (`Toast.createToastManager()`, as in Base UI). Create one in a module and
 * import it where toasts are added and shown.
 */
function createToastManager(): ToastManager {
  const prefix = `toast-${(managers += 1)}-`;
  let count = 0;
  const list = signal<ManagedToast[]>([]);
  const find = (id: string) => list().find((each) => each.record.id === id);
  const remove = (id: string) => {
    const toast = find(id);
    if (!toast) return;
    list.set(list().filter((each) => each !== toast));
    toast.record.onRemove?.();
  };
  const close = (id: string) => {
    const toast = find(id);
    if (!toast || toast.record.transitionStatus === "ending") return;
    toast.set({ transitionStatus: "ending" });
    toast.record.onClose?.();
  };
  const owner = { remove, close };

  const manager: ToastManager = {
    toasts: () => list().map((each) => each.record),
    add(options) {
      const id = options.id ?? `${prefix}${(count += 1)}`;
      // An open toast with that id changes in place, as `update` would (TASK-442 L4).
      const open = find(id);
      if (open && open.record.transitionStatus !== "ending") {
        open.set(options);
        return id;
      }
      const toast = managed(id, options);
      owners.set(toast.record, owner);
      list.set([toast, ...list().filter((each) => each.record.id !== id)]);
      return id;
    },
    update(id, options) {
      find(id)?.set(options);
    },
    close(id) {
      if (id !== undefined) close(id);
      else for (const each of list()) close(each.record.id);
    },
    async promise(promise, options) {
      const id = manager.add({ timeout: 0, type: "loading", ...asOptions(options.loading) });
      try {
        const value = await promise;
        const success = options.success;
        manager.update(id, {
          type: "success",
          timeout: undefined,
          ...asOptions(typeof success === "function" ? success(value) : success),
        });
        return value;
      } catch (error) {
        const failure = options.error;
        manager.update(id, {
          type: "error",
          timeout: undefined,
          ...asOptions(typeof failure === "function" ? failure(error) : failure),
        });
        throw error;
      }
    },
  };
  return manager;
}

interface ToastContextValue {
  manager: ToastManager;
  timeout: () => number;
  limit: () => number;
}

interface ToastItemContextValue {
  toast: ToastObject | (ToastOptions & { id?: string });
  /** The toast element's id, for its close buttons. */
  elementId: string;
}

const ToastContext = createContext<ToastContextValue>();
const ToastItemContext = createContext<ToastItemContextValue>();

function useToastItem(): ToastItemContextValue {
  const context = useContext(ToastItemContext);
  if (!context) throw new Error("Toast parts must be inside <Toast.Root>.");
  return context;
}

/** The manager of the closest `Toast.Provider`. */
function useToastManager(): ToastManager {
  const context = useContext(ToastContext);
  if (!context) throw new Error("Toast.useToastManager() must be called inside <Toast.Provider>.");
  return context.manager;
}

function Provider(props: ToastProviderProps) {
  // The provider keeps the manager it started with.
  const manager = untrack(() => props.toastManager ?? createToastManager());
  const context: ToastContextValue = {
    manager,
    timeout: () => props.timeout ?? DEFAULT_TIMEOUT,
    limit: () => props.limit ?? DEFAULT_LIMIT,
  };
  return <ToastContext value={context}>{props.children}</ToastContext>;
}

function Viewport({ children, ...rest }: ToastViewportProps) {
  // Timers, the limit, swipes, F6 and the top layer; the page loads it once (decision-63).
  toastScript();
  const provider = useContext(ToastContext);
  return (
    <lu-toast-viewport
      role="region"
      aria-label="Notifications (F6)"
      tabindex={-1}
      {...rest}
      data-limit={String(provider?.limit() ?? DEFAULT_LIMIT)}
    >
      {children}
    </lu-toast-viewport>
  );
}

function Root({ toast, swipeDirection, children, ref: forwarded, ...rest }: ToastRootProps) {
  toastScript();
  const provider = useContext(ToastContext);
  // Its Close points at it: a caller's `id` names it (TASK-441 M39).
  const generated = useId();
  const elementId = untrack(() => rest.id) ?? generated;
  const element = ref<HTMLDivElement>();
  const owner = owners.get(toast);
  const ending = () => (toast as ToastObject).transitionStatus === "ending";

  // A managed toast that closes: once its exit animation is over, its manager removes it.
  effect(() => {
    const node = element();
    if (!owner || !node || !ending()) return;
    // After the update that sets `data-ending-style`, which starts the exit.
    queueMicrotask(() => void afterAnimations(node).then(() => owner.remove(toast.id!)));
  });

  return (
    <ToastItemContext value={{ toast, elementId }}>
      <div
        role={toast.priority === "high" ? "alert" : "status"}
        aria-atomic="true"
        {...rest}
        ref={(node: HTMLDivElement) => {
          element(node);
          forwarded?.(node);
        }}
        id={elementId}
        data-type={toast.type}
        data-timeout={String(toast.timeout ?? provider?.timeout() ?? DEFAULT_TIMEOUT)}
        data-swipe-directions={(swipeDirection ?? ["down", "right"]).join(" ") || undefined}
        data-ending-style={ending() ? "" : undefined}
        on:close={(event: Event) => {
          // The script closes it: a managed toast leaves through its manager.
          if (!owner) return;
          event.preventDefault();
          owner.close(toast.id!);
        }}
      >
        {children}
      </div>
    </ToastItemContext>
  );
}

function Content({ children, ...rest }: ToastContentProps) {
  return <div {...rest}>{children}</div>;
}

function Title({ children, ...rest }: ToastTitleProps) {
  const item = useToastItem();
  const content = () => children ?? item.toast.title;
  return <>{content() ? <h2 {...rest}>{content()}</h2> : null}</>;
}

function Description({ children, ...rest }: ToastDescriptionProps) {
  const item = useToastItem();
  const content = () => children ?? item.toast.description;
  return <>{content() ? <p {...rest}>{content()}</p> : null}</>;
}

/**
 * The `actionProps` keys the action button takes. A toast's options may be a notification or
 * realtime payload passed as it arrived, so a key such as `type`, `formaction` or `style` from it
 * must not reach the button (TASK-470). Props written on `Toast.Action` are the page's own.
 */
const ACTION_KEY = /^(?:children|onClick|class|disabled|aria-[a-z]+)$/;

function allowed(props: ToastActionProps | undefined): ToastActionProps | undefined {
  if (!props) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (ACTION_KEY.test(key)) out[key] = props[key as keyof ToastActionProps];
  }
  return out as ToastActionProps;
}

function Action({ children, ...rest }: ToastActionProps) {
  const item = useToastItem();
  const props = () => allowed(item.toast.actionProps);
  return (
    <>
      {props() || children ? (
        <button type="button" {...props()} {...rest}>
          {children ?? props()?.children}
        </button>
      ) : null}
    </>
  );
}

function Close({ children, ...rest }: ToastCloseProps) {
  const item = useToastItem();
  return (
    <button type="button" {...rest} command={CLOSE_COMMAND} commandfor={item.elementId}>
      {children}
    </button>
  );
}

/**
 * Toasts: short notices in a region of their own, after Base UI's toast. Server HTML can render
 * them (a form action's result); islands add them through a manager. `<lu-toast-viewport>`'s
 * script times them, pauses on hover and focus, limits how many show, closes them on a swipe,
 * Escape or their close button, and focuses the region on F6. Unstyled: style the parts through
 * `class`, `[data-type]`, `[data-starting-style]`, `[data-ending-style]`, `[data-swiping]` and the
 * `--lu-toast-swipe-movement-x`/`-y` and `--lu-toast-index` variables.
 *
 * @example
 * const toasts = Toast.createToastManager();
 * toasts.add({ title: "Saved", description: "Your changes are live." });
 *
 * <Toast.Provider toastManager={toasts}>
 *   <Toast.Viewport>
 *     {toasts.toasts().map((toast) => (
 *       <Toast.Root toast={toast}>
 *         <Toast.Title />
 *         <Toast.Description />
 *         <Toast.Close aria-label="Close">×</Toast.Close>
 *       </Toast.Root>
 *     ))}
 *   </Toast.Viewport>
 * </Toast.Provider>
 */
export const Toast = {
  Provider,
  Viewport,
  Root,
  Content,
  Title,
  Description,
  Action,
  Close,
  createToastManager,
  useToastManager,
};
