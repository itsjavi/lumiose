// Input (decision-62, TASK-365): a native `<input>` that takes its id, name, disabled state and ARIA
// references from the Field around it, after Base UI's Input (Field.Control). Everything else is
// the platform's: types, constraints, autofill, forms.
import { ref, untrack } from "lumiose";
import { fieldProps, useField, useFormValues } from "../field/context.ts";
import { onFormReset } from "../form/reset.ts";
import { batched } from "../batched.ts";

/**
 * An element's props without the brand of intrinsic elements' props, so that the component's
 * `value` and `onValueChange` offer `bind:value`.
 */
type BindableProps<Tag extends keyof JSX.IntrinsicElements, Omitted extends string = never> = Omit<
  JSX.IntrinsicElements[Tag],
  symbol | Omitted
>;

/**
 * An `<input>`, with every native prop (`type`, `required`, `pattern`, `placeholder`, …). Inside a
 * `Field.Root` it takes the field's id, name and ARIA references. `bind:value={signal}` stands in
 * for `value` and `onValueChange`.
 */
export type InputProps = BindableProps<"input", "value" | "bind:value"> & {
  /** Sets the value when it changes. Pair it with `onValueChange` to keep a signal in sync. */
  value?: string;
  /** The value at first, when `value` is left out; a form reset goes back to it. */
  defaultValue?: string;
  /** Called with the new value on every edit. */
  onValueChange?: (value: string) => void;
};

/**
 * A native text input, part of a `Field` when it is inside one.
 *
 * @example
 * <Input name="q" type="search" aria-label="Search" bind:value={query} />
 */
/**
 * Types a Form's `values` never fill: secrets, files, buttons, and toggles, which have `checked`.
 * HTML matches `type` in any case, so `PASSWORD` is a password too (TASK-472).
 */
const UNFILLED = /^\s*(password|file|hidden|submit|reset|button|image|checkbox|radio)\s*$/i;

export function Input({ value, defaultValue, onValueChange, ...rest }: InputProps) {
  const field = useField();
  // The value a failed submission sent back (a Form's `values`) replaces the default (TASK-430).
  const sent = UNFILLED.test(String(untrack(() => rest.type) ?? ""))
    ? undefined
    : useFormValues(
        untrack(() => rest.name ?? field?.name()),
        untrack(() => rest.disabled),
      );
  // A form reset fires no `input`: the reset value goes to `onValueChange` (TASK-435).
  const input = ref<HTMLInputElement>();
  if (onValueChange) onFormReset(input, () => input()!.value, onValueChange);
  return (
    <input
      {...rest}
      {...fieldProps(field, rest)}
      ref={(element: HTMLInputElement) => {
        input(element);
        rest.ref?.(element);
      }}
      value={value !== undefined ? value : untrack(() => sent?.[0] ?? defaultValue)}
      on:input={batched((event: Event) =>
        onValueChange?.((event.currentTarget as HTMLInputElement).value),
      )}
    />
  );
}
