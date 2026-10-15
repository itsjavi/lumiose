// Field (decision-62, TASK-365): a label, a control, a description and its errors, wired together
// after Base UI's Field. The control is native (an `<input>`, a checkbox, a `<select>`), so
// constraint validation, `:invalid` and blocking a submission are the browser's; Field.Root
// renders `<lu-field>`, and field.script.ts (decision-63) shows the browser's verdict in the
// field's Error parts at the right time instead of the browser's bubble. Server errors, from a
// Form's `errors`, render in the HTML: they work without JavaScript.
import { effect, isServer, onCleanup, onMount, signal, untrack, useContext, useId } from "lumiose";
import {
  controlId,
  errorId,
  FieldContext,
  FormContext,
  type FieldContextValue,
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

/** A validity check of the field's own: the message when the value is invalid, else nothing. */
export type FieldValidate = (value: string | boolean) => string | null | undefined;

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
   */
  validate?: FieldValidate;
};

/** The `<label>` of the field's control. */
export type FieldLabelProps = JSX.IntrinsicElements["label"];

/** The field's `<input>`: `Input`, with every native prop. */
export type FieldControlProps = InputProps;

/** A `<p>` that describes the control; the control's `aria-describedby` names it. */
export type FieldDescriptionProps = JSX.IntrinsicElements["p"];

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

function Root({
  name,
  disabled,
  invalid,
  validationMode,
  validate,
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
  const field: FieldContextValue = {
    id,
    name: () => name,
    disabled: () => disabled === true,
    invalid: () => invalid === true || messages().length > 0,
    messages,
    descriptions: signal(0),
  };

  // `validate` sets the control's custom validity on every edit, and once at the start.
  const run = (target: EventTarget | null) => {
    if (!validate || !(target instanceof HTMLElement)) return;
    const control = target as HTMLInputElement;
    if (typeof control.setCustomValidity !== "function") return;
    const value = /^(checkbox|radio)$/.test(control.type) ? control.checked : control.value;
    control.setCustomValidity(untrack(() => validate(value)) ?? "");
  };
  effect(() => {
    if (!validate) return;
    const element = document.getElementById(controlId(field));
    if (element) run(element);
  });

  return (
    <FieldContext value={field}>
      <lu-field
        {...rest}
        id={id}
        validation-mode={validationMode ?? form?.validationMode()}
        on:input={(event: Event) => run(event.target)}
        on:change={(event: Event) => run(event.target)}
      >
        {children}
      </lu-field>
    </FieldContext>
  );
}

function useFieldPart(part: string): FieldContextValue {
  const field = useContext(FieldContext);
  if (!field) throw new Error(`Field.${part} must be inside <Field.Root>.`);
  return field;
}

function Label({ children, ...rest }: FieldLabelProps) {
  const field = useFieldPart("Label");
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
    <p {...rest} id={`${field.id}-description`}>
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
  /** `<id>-error`, `<id>-error-invalid`, `<id>-error-always`, `<id>-error-<key>`. */
  const id = () =>
    `${errorId(field)}${
      match === undefined ? (message() ? "" : "-invalid") : match === true ? "-always" : `-${match}`
    }`;
  return (
    <output {...rest} id={id()} for={message() ? controlId(field) : undefined} hidden={!visible()}>
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
export const Field = { Root, Label, Control: Input, Description, Error: ErrorPart };
