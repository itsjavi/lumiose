// The context a Field gives the control inside it (Input, Checkbox, Switch, Radio, Select): the
// control takes the field's id, name, disabled state and ARIA references unless its own props set
// them. The Form's context gives the fields its server errors and default validation mode.
import { createContext, untrack, useContext, type Signal } from "lumiose";

/** When a field shows its validation errors (Base UI's modes). */
export type ValidationMode = "onSubmit" | "onBlur" | "onChange";

/** Server errors by field name: a message or several. */
export type FormErrors = object;

/**
 * The values a form action sends back after a failed submission (TASK-430): the submitted
 * `FormData`, or values by field name.
 */
export type FormValues =
  | FormData
  | URLSearchParams
  | Readonly<Record<string, string | readonly string[] | null | undefined>>;

export interface FormContextValue {
  errors: () => FormErrors | null | undefined;
  validationMode: () => ValidationMode | undefined;
  values: () => FormValues | null | undefined;
}

export const FormContext = createContext<FormContextValue>();

/**
 * What the Form's `values` hold for a control's `name`, read once as the control's default: every
 * value under the name (`[]` when the submission left it out, as for an unchecked checkbox), or
 * `undefined` without `values` or a name, and for a disabled control, which submits nothing
 * (`disabled` here, a Field's, or a disabled `Fieldset.Root`'s).
 */
export function useFormValues(name: string | undefined, disabled?: unknown): string[] | undefined {
  const values = untrack(() => useContext(FormContext)?.values());
  if (values == null || !name || disabled || untrack(() => useField()?.disabled())) {
    return undefined;
  }
  if (values instanceof FormData || values instanceof URLSearchParams) {
    return values.getAll(name).filter((value): value is string => typeof value === "string");
  }
  const value = (values as Record<string, unknown>)[name];
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** The field's validity, for `Field.Validity`: the control's, from its last check. */
export interface FieldValidityState {
  /**
   * The control's `ValidityState`, with `valid` `null` until the field is first checked (an edit,
   * a blur or a submit attempt), or `false` from a server error.
   */
  validity: { [K in keyof ValidityState]: K extends "valid" ? boolean | null : boolean };
  /** The first problem's message (the browser's, `validate`'s or the server's); `""` when none. */
  error: string;
  /** Every message: the server's, or the one above. */
  errors: string[];
  /** The control's value, `checked` for a checkbox or switch; `null` until the first check. */
  value: string | boolean | null;
  /** An async `validate` is running. */
  validating: boolean;
}

export interface FieldContextValue {
  /** The `lu-field`'s id; the parts' ids derive from it. */
  id: string;
  name: () => string | undefined;
  disabled: () => boolean;
  /** Invalid from the server (the Form's errors) or the `invalid` prop. */
  invalid: () => boolean;
  /** The Form's error messages for the field's name. */
  messages: () => string[];
  /** How many Description parts are rendered. */
  descriptions: Signal<number>;
  /**
   * Parts rendered so far, by kind (`description`, or an Error's match): the second and later of a
   * kind get an id of their own, `-2`, `-3`… (TASK-446, L14).
   */
  rendered: Map<string, number>;
  /** How many Label parts are rendered: a group control is named by the label (TASK-439). */
  labels: Signal<number>;
  /** The control's validity from its last check, in the browser (`Field.Validity`). */
  validity: () => FieldValidityState;
}

export const FieldContext = createContext<FieldContextValue>();

/** The id of the field's control, which its Label points at. */
export const controlId = (field: FieldContextValue) => `${field.id}-control`;

/** The field's error slot: the `Field.Error` without `match`, which shows the field's message. */
export const errorId = (field: FieldContextValue) => `${field.id}-error`;

/**
 * The ids that describe the field's control: its descriptions and, while it is invalid from the
 * server or the `invalid` prop, its error. The client script adds the errors it shows.
 */
export function describedBy(field: FieldContextValue): string | undefined {
  const ids = [
    ...Array.from({ length: field.descriptions() }, (_, i) =>
      numbered(`${field.id}-description`, i),
    ),
    field.invalid() ? errorId(field) : "",
  ].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/**
 * The id that names a group control (a Radio Group or Checkbox Group) in a field: the Label's, as
 * a group has no single element for the Label's `for` (TASK-439). `undefined` without a Label.
 */
export const labelledBy = (field: FieldContextValue | undefined) =>
  field && field.labels() > 0 ? `${field.id}-label` : undefined;

/** `id` for the first part of a kind, `id-2`, `id-3`… for the next ones. */
export const numbered = (id: string, index: number) => (index === 0 ? id : `${id}-${index + 1}`);

/** The index of the next part of `kind` in `field` (render order, the same on both sides). */
export function nextIndex(field: FieldContextValue, kind: string): number {
  const index = field.rendered.get(kind) ?? 0;
  field.rendered.set(kind, index + 1);
  return index;
}

export const useField = () => useContext(FieldContext);

/**
 * A control's wiring from its field, for the props the control was given: its own `id`, `name`,
 * `disabled` and ARIA references win.
 */
export function fieldProps(
  field: FieldContextValue | undefined,
  own: {
    id?: string;
    name?: string;
    disabled?: boolean;
    "aria-describedby"?: string | number | boolean;
    "aria-invalid"?: string | number | boolean;
  },
): {
  id?: string;
  name?: string;
  disabled?: boolean;
  "aria-describedby"?: string | number | boolean;
  "aria-invalid"?: string | number | boolean;
} {
  if (!field) return {};
  return {
    id: own.id ?? controlId(field),
    name: own.name ?? field.name(),
    disabled: own.disabled || field.disabled() || undefined,
    "aria-describedby": own["aria-describedby"] ?? describedBy(field),
    "aria-invalid": own["aria-invalid"] ?? (field.invalid() || undefined),
  };
}
