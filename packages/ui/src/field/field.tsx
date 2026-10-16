// Field (decision-62, TASK-365): a label, a control, a description and its errors, wired together
// after Base UI's Field. The control is native (an `<input>`, a checkbox, a `<select>`), so
// constraint validation, `:invalid` and blocking a submission are the browser's; Field.Root
// renders `<lu-field>`, and field.script.ts (decision-63) shows the browser's verdict in the
// field's Error parts at the right time instead of the browser's bubble. Server errors, from a
// Form's `errors`, render in the HTML: they work without JavaScript. A `validate` function (an
// island) sets the control's custom validity; when it is async, the latest edit's verdict wins and
// a `validitychange` event on the control asks the script to show it.
import {
  effect,
  isServer,
  onCleanup,
  onMount,
  ref,
  signal,
  untrack,
  useContext,
  useId,
} from "lumiose";
import {
  controlId,
  errorId,
  FieldContext,
  nextIndex,
  numbered,
  FormContext,
  type FieldContextValue,
  type FieldValidityState,
  type ValidationMode,
} from "./context.ts";
import fieldScript from "./field.script.ts?client";
import { Input, type InputProps } from "../input/input.tsx";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * Field's element, rendered by `Field.Root`. Attribute `validation-mode`: when the field
       * shows its errors (`onSubmit`, `onBlur`, `onChange`).
       */
      "lu-field": JSX.HTMLProps<HTMLElement> & { "validation-mode"?: ValidationMode };
    }
  }
}

/**
 * A validity check of the field's own: the message when the value is invalid, else nothing, or a
 * promise of it (a server check). Only the latest edit's result applies.
 */
export type FieldValidate = (
  value: string | boolean,
) => string | null | undefined | Promise<string | null | undefined>;

export type { FieldValidityState };

/** The `ValidityState` keys a `Field.Error` can match. */
export type FieldErrorMatch = Exclude<keyof ValidityState, "valid">;

/**
 * `Field.Root` renders `<lu-field>`, a block around the label, the control, the description and
 * the errors.
 */
export type FieldRootProps = JSX.HTMLProps<HTMLElement> & {
  /**
   * The control's `name` (unless it has its own), and the key of the field's server errors in the
   * Form's `errors`.
   */
  name?: string;
  /** The control is disabled. */
  disabled?: boolean;
  /**
   * Marks the field invalid, as a server error does: its Error shows and the control gets
   * `aria-invalid`, until the value changes.
   */
  invalid?: boolean;
  /**
   * When the field shows its errors: after a submit attempt (`"onSubmit"`, the default, or the
   * Form's), also when the control loses focus (`"onBlur"`), or as soon as it is edited
   * (`"onChange"`). Once shown, errors follow the value as you type.
   */
  validationMode?: ValidationMode;
  /**
   * A check of your own, run on every edit in the browser (an island): return the message when
   * the value is invalid. It becomes the control's custom validity, so a submit is blocked and the
   * Error shows the message. The value is the control's, or `checked` for a checkbox or switch.
   * An async check clears the message until it settles (`data-validating` on the field meanwhile)
   * and does not block a submission that comes first; a newer edit discards an older result.
   */
  validate?: FieldValidate;
  /**
   * How long typing must pause before `validate` runs, in ms: fewer server checks while the
   * user types. Default `0`.
   */
  validationDebounceTime?: number;
};

/** The `<label>` of the field's control. */
export type FieldLabelProps = JSX.IntrinsicElements["label"];

/** The field's `<input>`: `Input`, with every native prop. */
export type FieldControlProps = InputProps;

/** A `<p>` that describes the control; the control's `aria-describedby` names it. */
export type FieldDescriptionProps = JSX.IntrinsicElements["p"];

/**
 * Renders what `children` returns for the field's validity, again whenever it changes: an edit, a
 * blur, a submit attempt, a `validate` result or a server error. Before the first check (and on
 * the server) `validity.valid` is `null`.
 */
export type FieldValidityProps = {
  /** Renders from the field's validity: text, or elements inside an element of yours. */
  children: (state: FieldValidityState) => JSX.Element;
};

/**
 * An `<output>` with an error message of the field. Without children it shows the field's
 * message (`<output for>` the control): a server error, or the browser's (or `validate`'s) message
 * for the problem. With children it shows them.
 */
export type FieldErrorProps = JSX.HTMLProps<HTMLElement> & {
  /**
   * When it shows: for any problem (left out), only for one `ValidityState` problem
   * (`"valueMissing"`, `"typeMismatch"`, …), or always (`true`).
   */
  match?: FieldErrorMatch | true;
};

/** The `ValidityState` keys, `valid` included. */
const KEYS = [
  "badInput",
  "customError",
  "patternMismatch",
  "rangeOverflow",
  "rangeUnderflow",
  "stepMismatch",
  "tooLong",
  "tooShort",
  "typeMismatch",
  "valueMissing",
  "valid",
] as const;

const VALID: FieldValidityState["validity"] = {
  ...(Object.fromEntries(KEYS.map((key) => [key, false])) as FieldValidityState["validity"]),
  valid: true,
};

const UNCHECKED: FieldValidityState = {
  validity: { ...VALID, valid: null },
  error: "",
  errors: [],
  value: null,
  validating: false,
};

const toggles = (control: Partial<HTMLInputElement>) =>
  control.type === "checkbox" || control.type === "radio";

const fieldOf = (node: Element) => node.closest?.("lu-field") ?? null;

const isPromise = <T,>(value: T | Promise<T>): value is Promise<T> =>
  typeof (value as { then?: unknown } | null)?.then === "function";

function Root({
  name,
  disabled,
  invalid,
  validationMode,
  validate,
  validationDebounceTime,
  children,
  ...rest
}: FieldRootProps) {
  // Shows the browser's validation in the Error parts; the page loads it once (decision-63).
  fieldScript();
  const id = useId();
  const form = useContext(FormContext);
  const messages = () => {
    const errors = name ? form?.errors() : undefined;
    const value = errors ? (errors as Record<string, unknown>)[name!] : undefined;
    if (typeof value === "string") return value ? [value] : [];
    return Array.isArray(value) ? value.filter((m): m is string => typeof m === "string") : [];
  };
  /** The last check of the control, and the Form's errors it saw. */
  const checked = signal<{ state: FieldValidityState; errors: unknown } | undefined>(undefined);
  const validity = (): FieldValidityState => {
    const last = checked();
    const server = messages();
    // A server error newer than the last check is the verdict, until the next edit.
    if (server.length > 0 && (!last || last.errors !== form?.errors())) {
      return {
        validity: { ...VALID, valid: false },
        error: server.join(" "),
        errors: server,
        value: last?.state.value ?? null,
        validating: false,
      };
    }
    return last?.state ?? UNCHECKED;
  };
  const field: FieldContextValue = {
    id,
    name: () => name,
    disabled: () => disabled === true,
    invalid: () => invalid === true || messages().length > 0,
    messages,
    descriptions: signal(0),
    rendered: new Map(),
    labels: signal(0),
    validity,
  };

  const host = ref<HTMLElement>();
  const snapshot = (target: EventTarget | null) => {
    const control = target as Partial<HTMLInputElement> | null;
    if (!control?.validity || fieldOf(control as Element) !== host()) return;
    const state = control.validity;
    const error = control.validationMessage ?? "";
    checked.set({
      state: {
        validity: Object.fromEntries(
          KEYS.map((key) => [key, state[key]]),
        ) as FieldValidityState["validity"],
        error,
        errors: error ? [error] : [],
        value: toggles(control) ? control.checked! : (control.value ?? null),
        validating: host()?.hasAttribute("data-validating") === true,
      },
      errors: untrack(() => form?.errors()),
    });
  };

  // `validate` sets the control's custom validity on every edit, and quietly (no check for
  // `Field.Validity`) at the start and after a reset. A newer run makes an older one's pending
  // result stale.
  let latest = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** A debounced check that has not run yet: a submit attempt runs it first (TASK-459). */
  let due: (() => void) | undefined;
  /** The value of the last async check, whose verdict (pending or not) stands for that value. */
  let checking: { value: string | boolean } | undefined;
  onCleanup(() => clearTimeout(timer));
  const pending = (on: boolean) => host()?.toggleAttribute("data-validating", on);
  const run = (target: EventTarget | null, wait = 0, quiet = false) => {
    if (!validate || !(target instanceof HTMLElement)) return;
    const control = target as HTMLInputElement;
    if (typeof control.setCustomValidity !== "function") return;
    const value = toggles(control) ? control.checked : control.value;
    // The blur's `change` after an edit: that value's server check stands, no second request.
    if (checking?.value === value) return;
    const mine = ++latest;
    clearTimeout(timer);
    due = undefined;
    const apply = (message: string | null | undefined, later: boolean) => {
      if (mine !== latest || !control.isConnected) return;
      control.setCustomValidity(message ?? "");
      pending(false);
      // The script showed the edit already: a later verdict asks it to show this one.
      if (later) control.dispatchEvent(new Event("validitychange"));
      if (!quiet) snapshot(control);
    };
    const check = (later: boolean) => {
      const result = untrack(() => validate(value));
      checking = isPromise(result) ? { value } : undefined;
      if (!isPromise(result)) return apply(result, later);
      // The last verdict was about another value: none until this one settles.
      control.setCustomValidity("");
      pending(true);
      // A check that fails (the network) blocks nothing: the server validates again.
      result.then(
        (message) => apply(message, true),
        () => apply(null, true),
      );
    };
    if (wait <= 0) return check(false);
    control.setCustomValidity("");
    pending(true);
    due = () => {
      due = undefined;
      check(true);
    };
    timer = setTimeout(due, wait);
  };
  /**
   * A submission inside the debounce window would pass the browser's checks without `validate`
   * (cleared while it waits): its check runs now, and a synchronous one that fails stops the
   * submission, which the form then reports. An async check still waits for the server.
   */
  const onSubmit = (event: Event) => {
    if (!due) return;
    clearTimeout(timer);
    due();
    const control = document.getElementById(controlId(field)) as HTMLInputElement | null;
    if (!control || control.validity.valid) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    (event.currentTarget as HTMLFormElement).reportValidity();
  };
  effect(() => {
    if (!validate) return;
    const element = document.getElementById(controlId(field));
    if (element) untrack(() => run(element, 0, true));
  });
  // A form action's errors for this field, each time they arrive: the script shows them again
  // even when they repeat, which no binding would apply again once an edit hid them (TASK-429).
  effect(() => {
    const errors = form?.errors();
    const list = messages();
    const element = untrack(host);
    if (errors && list.length > 0 && element) {
      element.dispatchEvent(new CustomEvent("validitychange", { detail: { errors: list } }));
    }
  });
  // A submit attempt checks every control (`invalid` does not bubble); a reset clears the checks.
  const onInvalid = (event: Event) => snapshot(event.target);
  const onReset = () => {
    checked.set(undefined);
    checking = undefined;
    // The controls take their default values after the event.
    setTimeout(() => run(document.getElementById(controlId(field)), 0, true));
  };
  onMount(() => {
    const element = host();
    if (!element) return;
    const owner = element.closest("form");
    element.addEventListener("invalid", onInvalid, true);
    owner?.addEventListener("reset", onReset);
    // Capturing: before the form's own `submit` listeners.
    owner?.addEventListener("submit", onSubmit, true);
    onCleanup(() => {
      element.removeEventListener("invalid", onInvalid, true);
      owner?.removeEventListener("reset", onReset);
      owner?.removeEventListener("submit", onSubmit, true);
    });
  });

  return (
    <FieldContext value={field}>
      <lu-field
        {...rest}
        ref={(element: HTMLElement) => {
          host(element);
          rest.ref?.(element);
        }}
        id={id}
        validation-mode={validationMode ?? form?.validationMode()}
        on:input={(event: Event) => {
          run(event.target, validationDebounceTime);
          snapshot(event.target);
        }}
        on:change={(event: Event) => {
          run(event.target);
          snapshot(event.target);
        }}
        on:focusout={(event: Event) => snapshot(event.target)}
      >
        {children}
      </lu-field>
    </FieldContext>
  );
}

function Validity({ children }: FieldValidityProps) {
  const field = useFieldPart("Validity");
  return <>{children(field.validity())}</>;
}

function useFieldPart(part: string): FieldContextValue {
  const field = useContext(FieldContext);
  if (!field) throw new Error(`Field.${part} must be inside <Field.Root>.`);
  return field;
}

function Label({ children, ...rest }: FieldLabelProps) {
  const field = useFieldPart("Label");
  // Counted as Description is, for the group controls it names (TASK-439).
  let counted = false;
  const register = () => {
    counted = true;
    field.labels.update((n) => n + 1);
  };
  onCleanup(() => {
    if (counted) field.labels.update((n) => n - 1);
  });
  if (isServer) register();
  else onMount(register);
  return (
    <label {...rest} id={`${field.id}-label`} for={controlId(field)}>
      {children}
    </label>
  );
}

function Description({ children, ...rest }: FieldDescriptionProps) {
  const field = useFieldPart("Description");
  // The server counts it as it renders (a control after it sees it); the browser once mounted,
  // so hydrating the control before it does not change under its feet.
  let counted = false;
  const register = () => {
    counted = true;
    field.descriptions.update((n) => n + 1);
  };
  onCleanup(() => {
    if (counted) field.descriptions.update((n) => n - 1);
  });
  if (isServer) register();
  else onMount(register);
  return (
    <p {...rest} id={numbered(`${field.id}-description`, nextIndex(field, "description"))}>
      {children}
    </p>
  );
}

function ErrorPart({ match, children, ...rest }: FieldErrorProps) {
  const field = useFieldPart("Error");
  // The script shows and hides it from then on. Without children it is the field's message, an
  // `<output for>` the control: the server's error, or the browser's message, which the script
  // writes into the same text node a new server error updates.
  const visible = () => match === true || (match === undefined && field.invalid());
  const message = () => children === undefined;
  /**
   * `<id>-error`, `<id>-error-invalid`, `<id>-error-always`, `<id>-error-<key>`; a second Error
   * of the same kind adds `-2` (TASK-446, L14).
   */
  const kind = `${errorId(field)}${
    match === undefined ? (message() ? "" : "-invalid") : match === true ? "-always" : `-${match}`
  }`;
  const index = nextIndex(field, kind);
  const id = () => numbered(kind, index);
  return (
    // Not a live region: the control's description says it, without re-announcing each keystroke
    // (TASK-439, M31).
    <output
      aria-live="off"
      {...rest}
      id={id()}
      for={message() ? controlId(field) : undefined}
      hidden={!visible()}
    >
      {message() ? field.messages().join(" ") : children}
    </output>
  );
}

/**
 * A form field: a label, a control (`Field.Control`, or Checkbox, Switch, Select), a description
 * and its errors, wired with `for`, `aria-describedby` and `aria-invalid`. Validation is the
 * browser's constraint validation (`required`, `type`, `pattern`, …), shown in the field instead
 * of the browser's bubble where JavaScript runs; server errors come from a `Form`'s `errors`.
 *
 * @example
 * <Field.Root name="email">
 *   <Field.Label>Email</Field.Label>
 *   <Field.Control type="email" required />
 *   <Field.Description>We never share it.</Field.Description>
 *   <Field.Error />
 * </Field.Root>
 */
export const Field = { Root, Label, Control: Input, Description, Error: ErrorPart, Validity };
