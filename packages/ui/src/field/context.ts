// The context a Field gives the control inside it (Input, Checkbox, Switch, Radio, Select): the
// control takes the field's id, name, disabled state and ARIA references unless its own props set
// them. The Form's context gives the fields its server errors and default validation mode.
import { createContext, useContext, type Signal } from "lumiose";

/** When a field shows its validation errors (Base UI's modes). */
export type ValidationMode = "onSubmit" | "onBlur" | "onChange";

/** Server errors by field name: a message or several. */
export type FormErrors = object;

export interface FormContextValue {
  errors: () => FormErrors | null | undefined;
  validationMode: () => ValidationMode | undefined;
}

export const FormContext = createContext<FormContextValue>();

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
    field.descriptions() > 0 ? `${field.id}-description` : "",
    field.invalid() ? errorId(field) : "",
  ].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
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
