// CheckboxGroup (decision-62, TASK-366): a native `<fieldset>` of checkboxes that share a name and
// a value (the checked ones' values), after Base UI's CheckboxGroup. The form submits each checked
// box under the name, and a disabled group disables them all, without JavaScript. A parent
// checkbox (`Checkbox.Root parent`) checks them all; checkbox.script.ts keeps it in step.
import { effect, ref, signal, untrack } from "lumiose";
import checkboxScript from "../checkbox/checkbox.script.ts?client";
import { CheckboxGroupContext } from "../checkbox/context.ts";
import { describedBy, labelledBy, useField, useFormValues } from "../field/context.ts";
import { onFormReset } from "../form/reset.ts";

/** The fieldset props CheckboxGroup passes through, without the brand of intrinsic elements' props. */
type FieldsetProps = Omit<JSX.IntrinsicElements["fieldset"], symbol>;

/**
 * `CheckboxGroup` renders a `<fieldset>`; name it with a `Fieldset.Legend` inside.
 * `bind:value={signal}` stands in for `value` and `onValueChange`.
 */
export type CheckboxGroupProps = FieldsetProps & {
  /** Checks the checkboxes with these values when it changes. Pair it with `onValueChange`. */
  value?: string[];
  /** The values checked at first, when `value` is left out. */
  defaultValue?: string[];
  /** Called with the checked values after the user checks or unchecks one. */
  onValueChange?: (value: string[]) => void;
  /** Every checkbox's value: a parent checkbox is checked when all of them are. */
  allValues?: string[];
  /** The name the checkboxes submit their values under, unless they have their own. */
  name?: string;
};

/**
 * A group of checkboxes with one value, the list of the checked ones, and an optional parent
 * checkbox that checks them all.
 *
 * @example
 * <CheckboxGroup name="toppings" defaultValue={["cheese"]}>
 *   <Fieldset.Legend>Toppings</Fieldset.Legend>
 *   <label><Checkbox.Root value="cheese" /> Cheese</label>
 *   <label><Checkbox.Root value="olives" /> Olives</label>
 * </CheckboxGroup>
 */
/** The values of the checked boxes: the DOM holds the state, a parent's toggle included. */
const checked = (group: HTMLFieldSetElement) =>
  [...group.querySelectorAll<HTMLInputElement>("input[type=checkbox]:not([data-parent])")]
    .filter((input) => input.closest("fieldset") === group && input.checked)
    .map((input) => input.value);

export function CheckboxGroup({
  value,
  defaultValue,
  onValueChange,
  allValues,
  name,
  children,
  ...rest
}: CheckboxGroupProps) {
  checkboxScript();
  // In a field, the group takes the field's wiring, not each checkbox (TASK-439, M25).
  const field = useField();
  // A failed submission's values (a Form's `values`) replace the default (TASK-430).
  const sent = useFormValues(
    untrack(() => name ?? field?.name()),
    untrack(() => rest.disabled),
  );
  const values = signal<readonly string[]>(untrack(() => value ?? sent ?? defaultValue ?? []));
  // The `value` prop drives the checkboxes when it changes.
  effect(() => {
    const next = value;
    if (next !== undefined) values.set(next);
  });
  const context = { values, allValues: () => allValues, name: () => name ?? field?.name() };
  const report = (next: string[]) => {
    values.set(next);
    onValueChange?.(next);
  };
  // A form reset puts the boxes back without a `change`: the group follows it (TASK-435).
  const group = ref<HTMLFieldSetElement>();
  onFormReset(group, () => checked(group()!), report);
  return (
    <CheckboxGroupContext value={context}>
      <fieldset
        {...rest}
        ref={(element: HTMLFieldSetElement) => {
          group(element);
          rest.ref?.(element);
        }}
        // Explicit, so Field's script describes and marks the group as one, as a radiogroup.
        role="group"
        disabled={rest.disabled || field?.disabled() || undefined}
        aria-labelledby={
          rest["aria-labelledby"] ?? (rest["aria-label"] ? undefined : labelledBy(field))
        }
        aria-describedby={rest["aria-describedby"] ?? (field ? describedBy(field) : undefined)}
        aria-invalid={rest["aria-invalid"] ?? (field?.invalid() ? "true" : undefined)}
        on:change={(event: Event) => {
          if (!(event.target as Element).matches("input[type=checkbox]")) return;
          // checkbox.script.ts ran first, for a parent's toggle.
          report(checked(event.currentTarget as HTMLFieldSetElement));
        }}
      >
        {children}
      </fieldset>
    </CheckboxGroupContext>
  );
}
