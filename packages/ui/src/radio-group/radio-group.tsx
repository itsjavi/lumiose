// RadioGroup and Radio (decision-62, TASK-367): native radios in a `<fieldset role="radiogroup">`,
// after Base UI's RadioGroup and Radio. The platform gives the group one tab stop (the checked
// radio, or the first), arrow keys that move and select (skipping disabled radios, following the
// direction), `required`, submission and reset, in server HTML and without JavaScript; the legend
// names the group. checkbox.script.ts adds read-only.
import { createContext, effect, signal, untrack, useContext, useId } from "lumiose";
import checkboxScript from "../checkbox/checkbox.script.ts?client";
import { describedBy, useField } from "../field/context.ts";

interface RadioGroupContextValue {
  name: () => string;
  value: () => string | undefined;
  required: () => boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue>();

/** The fieldset props RadioGroup passes through, without the brand of intrinsic elements' props. */
type FieldsetProps = Omit<JSX.IntrinsicElements["fieldset"], symbol>;

/**
 * `RadioGroup` renders a `<fieldset role="radiogroup">`; name it with a `Fieldset.Legend` inside.
 * `bind:value={signal}` stands in for `value` and `onValueChange`.
 */
export type RadioGroupProps = FieldsetProps & {
  /** Checks the radio with this value when it changes. Pair it with `onValueChange`. */
  value?: string;
  /** The radio checked at first, when `value` is left out. */
  defaultValue?: string;
  /** Called with the value of the radio the user checks. */
  onValueChange?: (value: string) => void;
  /** The name the radios share and submit under. Default: a generated one. */
  name?: string;
  /** A radio must be checked to submit the form. */
  required?: boolean;
  /** The radios cannot be checked, but stay focusable and are submitted (`aria-readonly`). */
  readOnly?: boolean;
};

/** `Radio.Root` renders an `<input type="radio">` of its group. */
export type RadioRootProps = Omit<
  JSX.IntrinsicElements["input"],
  symbol | "type" | "checked" | "value" | "name" | "bind:checked" | "bind:value"
> & {
  /** Required: the value the group takes, and submits, when this radio is checked. */
  value: string;
};

/**
 * A group of radios with one value. Native radios inside a fieldset: arrow keys, one tab stop,
 * forms and reset are the browser's.
 *
 * @example
 * <RadioGroup name="plan" defaultValue="pro">
 *   <Fieldset.Legend>Plan</Fieldset.Legend>
 *   <label><Radio.Root value="free" /> Free</label>
 *   <label><Radio.Root value="pro" /> Pro</label>
 * </RadioGroup>
 */
export function RadioGroup({
  value,
  defaultValue,
  onValueChange,
  name,
  required,
  readOnly,
  children,
  ...rest
}: RadioGroupProps) {
  checkboxScript();
  const field = useField();
  const id = useId();
  const selected = signal<string | undefined>(untrack(() => value ?? defaultValue));
  // The `value` prop drives the radios when it changes.
  effect(() => {
    const next = value;
    if (next !== undefined) selected.set(next);
  });
  const context: RadioGroupContextValue = {
    name: () => name ?? field?.name() ?? id,
    value: selected,
    required: () => required === true,
  };
  return (
    <RadioGroupContext value={context}>
      <fieldset
        {...rest}
        disabled={rest.disabled || field?.disabled() || undefined}
        aria-describedby={rest["aria-describedby"] ?? (field ? describedBy(field) : undefined)}
        aria-invalid={rest["aria-invalid"] ?? (field?.invalid() ? "true" : undefined)}
        role="radiogroup"
        aria-required={required ? "true" : undefined}
        aria-readonly={readOnly ? "true" : undefined}
        on:change={(event: Event) => {
          const radio = event.target as HTMLInputElement;
          if (radio.type !== "radio" || !radio.checked) return;
          selected.set(radio.value);
          onValueChange?.(radio.value);
        }}
      >
        {children}
      </fieldset>
    </RadioGroupContext>
  );
}

function Root({ value, ...rest }: RadioRootProps) {
  const group = useContext(RadioGroupContext);
  if (!group) throw new Error("Radio.Root must be inside <RadioGroup>.");
  return (
    <input
      required={group.required() || undefined}
      {...rest}
      type="radio"
      name={group.name()}
      value={value}
      checked={group.value() === value}
    />
  );
}

/**
 * A radio of a `RadioGroup`. Unstyled: style it through `class` and `:checked`, `:disabled` and
 * `:focus-visible` (with `appearance: none` to draw your own).
 */
export const Radio = { Root };
