// Switch (decision-62, TASK-368): a native `<input type="checkbox" role="switch">`, after Base UI's
// Switch: on or off, announced as a switch. Space and a label click toggle it, the form submits its
// value when on, reset and `required` work, in server HTML and without JavaScript (`<input switch>`
// exists only in Safari). Inside a Field it takes the field's id, name and ARIA references;
// checkbox.script.ts adds read-only.
import { untrack } from "lumiose";
import checkboxScript from "../checkbox/checkbox.script.ts?client";
import { fieldProps, useField, useFormValues } from "../field/context.ts";

/**
 * The native checkbox props Root passes through, without the brand of intrinsic elements' props,
 * so that `bind:checked` applies to Root.
 */
type InputProps = Omit<
  JSX.IntrinsicElements["input"],
  symbol | "type" | "role" | "checked" | "value" | "bind:checked" | "bind:value" | "readonly"
>;

/**
 * `Switch.Root` renders an `<input type="checkbox" role="switch">`. `bind:checked={signal}`
 * stands in for `checked` and `onCheckedChange`.
 */
export type SwitchRootProps = InputProps & {
  /** Turns it on (`true`) or off (`false`) when it changes. Pair it with `onCheckedChange`. */
  checked?: boolean;
  /** Whether it starts on when `checked` is left out; a form reset goes back to it. */
  defaultChecked?: boolean;
  /** Called after the user turns it on or off. */
  onCheckedChange?: (checked: boolean) => void;
  /** The value it submits when on. Default `"on"`. */
  value?: string;
  /** It cannot be toggled, but stays focusable and is submitted (`aria-readonly`). */
  readOnly?: boolean;
  /**
   * The value it submits when off; by default a switch that is off submits nothing. Needs the
   * client script (`data-unchecked-value`).
   */
  uncheckedValue?: string;
};

function Root({
  checked,
  defaultChecked,
  onCheckedChange,
  value,
  readOnly,
  uncheckedValue,
  ...rest
}: SwitchRootProps) {
  checkboxScript();
  const field = useField();
  // A failed submission's values (a Form's `values`): on when they hold its value (TASK-430).
  const sent = useFormValues(
    untrack(() => rest.name ?? field?.name()),
    untrack(() => rest.disabled),
  );
  const initial = untrack(() => (sent ? sent.includes(value ?? "on") : defaultChecked));
  return (
    <input
      {...rest}
      {...fieldProps(field, rest)}
      type="checkbox"
      role="switch"
      value={value}
      checked={checked ?? initial}
      aria-readonly={readOnly ? "true" : undefined}
      data-unchecked-value={uncheckedValue}
      on:change={(event: Event) =>
        onCheckedChange?.((event.currentTarget as HTMLInputElement).checked)
      }
    />
  );
}

/**
 * A native switch: a checkbox announced as a switch. Unstyled: style it through `class` and
 * `:checked`, `:disabled` and `:focus-visible`, with `appearance: none` to draw the track and thumb.
 *
 * @example
 * <label>
 *   <Switch.Root name="notifications" defaultChecked /> Notifications
 * </label>
 */
export const Switch = { Root };
