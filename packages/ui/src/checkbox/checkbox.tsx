// Checkbox (decision-62, TASK-366): a native `<input type="checkbox">`, after Base UI's Checkbox.
// The platform toggles it with Space and a label click, submits its value when checked, resets it
// with its form and validates `required`, in server HTML and without JavaScript. Inside a Field it
// takes the field's id, name and ARIA references; inside a CheckboxGroup, its checked state and
// name. checkbox.script.ts (decision-63) adds the indeterminate state of server HTML, the parent
// checkbox of a group and read-only.
import { effect, isServer, ref, untrack, useContext } from "lumiose";
import { fieldProps, useField, useFormValues } from "../field/context.ts";
import checkboxScript from "./checkbox.script.ts?client";
import { CheckboxGroupContext } from "./context.ts";

/**
 * The native checkbox props Root passes through (`name`, `required`, `disabled`, `form`, `id`,
 * `class`, `aria-*`, events), without the brand of intrinsic elements' props, so that
 * `bind:checked` applies to Root.
 */
type InputProps = Omit<
  JSX.IntrinsicElements["input"],
  symbol | "type" | "checked" | "value" | "bind:checked" | "bind:value" | "readonly"
>;

/**
 * `Checkbox.Root` renders an `<input type="checkbox">`. `bind:checked={signal}` stands in for
 * `checked` and `onCheckedChange`.
 */
export type CheckboxRootProps = InputProps & {
  /** Checks (`true`) or unchecks it when it changes. Pair it with `onCheckedChange`. */
  checked?: boolean;
  /** Whether it starts checked when `checked` is left out; a form reset goes back to it. */
  defaultChecked?: boolean;
  /** Called after the user checks or unchecks it. */
  onCheckedChange?: (checked: boolean) => void;
  /**
   * Shows it as neither checked nor unchecked (`:indeterminate`, mixed for assistive technology)
   * until the user toggles it.
   */
  indeterminate?: boolean;
  /**
   * The value it submits when checked (default `"on"`), and its identity in a CheckboxGroup's
   * `value`.
   */
  value?: string;
  /**
   * The "select all" checkbox of a CheckboxGroup: it checks every checkbox of the group, and is
   * checked, unchecked or indeterminate as they are. It is not submitted.
   */
  parent?: boolean;
  /** It cannot be toggled, but stays focusable and is submitted (`aria-readonly`). */
  readOnly?: boolean;
  /**
   * The value it submits when unchecked; by default an unchecked checkbox submits nothing. Needs
   * the client script (`data-unchecked-value`).
   */
  uncheckedValue?: string;
};

function Root({
  checked,
  defaultChecked,
  onCheckedChange,
  indeterminate,
  value,
  parent,
  readOnly,
  uncheckedValue,
  ...rest
}: CheckboxRootProps) {
  // Indeterminate in server HTML, parent checkboxes and read-only; the page loads it once.
  checkboxScript();
  const field = useField();
  const group = useContext(CheckboxGroupContext);
  // A failed submission's values (a Form's `values`): checked when they hold its value (TASK-430).
  const sent =
    group || parent
      ? undefined
      : useFormValues(
          untrack(() => rest.name ?? field?.name()),
          untrack(() => rest.disabled),
        );
  const initial = untrack(() => (sent ? sent.includes(value ?? "on") : defaultChecked));
  /** A parent's state from the group: checked when every value is, mixed when some are. */
  const parentState = () => {
    const all = group?.allValues() ?? [];
    const on = all.filter((each) => group!.values().includes(each)).length;
    return { checked: all.length > 0 && on === all.length, mixed: on > 0 && on < all.length };
  };
  const isChecked = () => {
    if (checked !== undefined) return checked;
    if (group && parent) return parentState().checked;
    if (group && value !== undefined) return group.values().includes(value);
    return initial;
  };
  const isMixed = () =>
    indeterminate === true || (group !== undefined && parent === true && parentState().mixed);
  // `indeterminate` is a property only: the server writes `data-indeterminate`, which the script
  // turns into the property; in the browser the component sets it.
  const input = ref<HTMLInputElement>();
  effect(() => {
    const element = input();
    if (element) element.indeterminate = isMixed();
  });
  return (
    <input
      {...rest}
      {...fieldProps(field, rest)}
      ref={(element: HTMLInputElement) => {
        input(element);
        rest.ref?.(element);
      }}
      type="checkbox"
      // A parent is never submitted.
      name={parent ? undefined : (rest.name ?? group?.name() ?? field?.name())}
      value={value}
      checked={isChecked()}
      data-indeterminate={isServer && isMixed() ? "" : undefined}
      data-parent={parent ? "" : undefined}
      aria-readonly={readOnly ? "true" : undefined}
      data-unchecked-value={uncheckedValue}
      on:change={(event: Event) =>
        onCheckedChange?.((event.currentTarget as HTMLInputElement).checked)
      }
    />
  );
}

/**
 * A native checkbox. Unstyled: style it through `class` and `:checked`, `:indeterminate`,
 * `:disabled` and `:focus-visible` (with `appearance: none` to draw your own box).
 *
 * @example
 * <label>
 *   <Checkbox.Root name="terms" required /> I accept the terms
 * </label>
 */
export const Checkbox = { Root };
