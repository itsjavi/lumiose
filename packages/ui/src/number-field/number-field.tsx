// Number Field (decision-62, TASK-375): a number input with stepper buttons, after Base UI's
// NumberField and the APG spinbutton. Root renders `<lu-number-field>`, whose script
// (number-field.script.ts) adds the keys, press-and-hold buttons, scrubbing, the wheel and
// commit-time clamping and formatting.
//
// The input is native either way. Without `format` it is an `<input type="number">`, which steps,
// validates and submits without JavaScript. With `format` (Intl.NumberFormat options) it is an
// `<input type="text" role="spinbutton">` that shows the formatted value, and a hidden input
// submits the number: a native number input cannot show grouping, a currency or a percentage.
// The `value` prop drives the element when it changes; the input's `input` and `change` events
// report back through `onValueChange` and `onValueCommitted`.
import {
  createContext,
  effect,
  ref,
  signal,
  untrack,
  useContext,
  useId,
  type Signal,
} from "lumiose";
import { controlId, describedBy, useField, useFormValues } from "../field/context.ts";
import { onFormReset } from "../form/reset.ts";
import { formatNumber, formatter } from "./format.ts";
import type { NumberFieldElement } from "./number-field.script.ts";
import numberFieldScript from "./number-field.script.ts?client";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * Number Field's element. Attributes `min`, `max`, `step`, `large-step`, `small-step`,
       * `snap-on-step`, `format` (`Intl.NumberFormat` options as JSON), `locale`,
       * `allow-wheel-scrub`, `allow-out-of-range`; property `value`.
       */
      "lu-number-field": JSX.HTMLProps<NumberFieldElement> & {
        min?: number;
        max?: number;
        step?: number;
        "large-step"?: number;
        "small-step"?: number;
        "snap-on-step"?: boolean;
        format?: string;
        locale?: string;
        "allow-wheel-scrub"?: boolean;
        "allow-out-of-range"?: boolean;
      };
    }
  }
}

/**
 * The element props Root passes to `<lu-number-field>`, without the brand of intrinsic elements'
 * props, so that `bind:value` applies to Root.
 */
type ElementProps = {
  [
    K in keyof JSX.HTMLProps<NumberFieldElement> as K extends string ? K : never
  ]: JSX.HTMLProps<NumberFieldElement>[K];
};

/**
 * `NumberField.Root` renders `<lu-number-field>`, a block around the other parts.
 * `bind:value={signal}` stands in for `value` and `onValueChange`.
 */
export interface NumberFieldRootProps extends Omit<
  ElementProps,
  "children" | "onChange" | "onInput" | "id"
> {
  /** Shows this number (`null`: empty) when it changes. Pair it with `onValueChange`. */
  value?: number | null;
  /** The number at first, when `value` is left out; a form reset goes back to it. */
  defaultValue?: number | null;
  /** Called as the number changes: typing, a key, a button, the wheel, a drag. */
  onValueChange?: (value: number | null) => void;
  /** Called when a change is done: the input left, a key pressed, a button or a drag released. */
  onValueCommitted?: (value: number | null) => void;
  /** The smallest number. Typed numbers below it become it when committed. */
  min?: number;
  /** The largest number. Typed numbers above it become it when committed. */
  max?: number;
  /** The step of the arrow keys, the buttons, the wheel and a drag. Default `1`. */
  step?: number;
  /** The step of Page Up, Page Down, and Shift with an arrow key or a button. Default `10`. */
  largeStep?: number;
  /** The step of Alt with an arrow key or a button. Default `0.1`. */
  smallStep?: number;
  /**
   * A step lands on the next multiple of its size (from `min`, or 0): 1.3 steps up to 2, not 2.3.
   */
  snapOnStep?: boolean;
  /**
   * How the number is shown: `Intl.NumberFormat` options (a currency, a percentage, grouping).
   * With it the input is a text field and a hidden input submits the number.
   */
  format?: Intl.NumberFormatOptions;
  /** The locale of the formatted number. Default: the browser's (the server's in server HTML). */
  locale?: string;
  /** The wheel steps the number while the input has focus and the pointer is over it. */
  allowWheelScrub?: boolean;
  /** Typed numbers outside `min` and `max` stay as typed, for the browser's validation to report. */
  allowOutOfRange?: boolean;
  /** The name the number is submitted under. */
  name?: string;
  /** The id of a form the field belongs to, when it is outside it. */
  form?: string;
  /** The input's id, for a `<label for>`. Default: generated, or the Field's. */
  id?: string;
  /** The form needs a number. */
  required?: boolean;
  /** The field cannot be used. */
  disabled?: boolean;
  /** The number can be read and submitted, not changed. */
  readOnly?: boolean;
  /** The other parts: a `Group` with the `Input` and the buttons, a `ScrubArea`. */
  children?: JSX.Element;
}

/** A `<div>` around the input and its buttons. */
export type NumberFieldGroupProps = JSX.IntrinsicElements["div"];

/**
 * The input: an `<input type="number">`, or with `format` an `<input type="text"
 * role="spinbutton">` showing the formatted number.
 */
export type NumberFieldInputProps = Omit<
  JSX.IntrinsicElements["input"],
  "type" | "value" | "min" | "max" | "step" | "name" | "form" | "required" | "readonly" | "id"
>;

/**
 * A `<button>` that steps the number up, out of the tab order (the arrow keys do it): a press
 * steps once, holding it repeats. Named "Increase" unless you give it an `aria-label`.
 */
export type NumberFieldIncrementProps = JSX.IntrinsicElements["button"];

/** A `<button>` that steps the number down, like `Increment`. Named "Decrease" by default. */
export type NumberFieldDecrementProps = JSX.IntrinsicElements["button"];

/** A `<span>` that steps the number as the pointer drags across it, often around the label. */
export type NumberFieldScrubAreaProps = JSX.IntrinsicElements["span"] & {
  /** The drag that changes the number: right goes up (`"horizontal"`, default), or up. */
  direction?: "horizontal" | "vertical";
  /** How many pixels of drag make one step. Default `2`. */
  pixelSensitivity?: number;
};

interface NumberFieldContextValue {
  inputId: string;
  value: Signal<number | null>;
  min: () => number | undefined;
  max: () => number | undefined;
  step: () => number | undefined;
  format: () => Intl.NumberFormatOptions | undefined;
  locale: () => string | undefined;
  name: () => string | undefined;
  form: () => string | undefined;
  required: () => boolean | undefined;
  disabled: () => boolean;
  readOnly: () => boolean | undefined;
}

const NumberFieldContext = createContext<NumberFieldContextValue>();

function useNumberField(part: string): NumberFieldContextValue {
  const context = useContext(NumberFieldContext);
  if (!context) throw new Error(`NumberField.${part} must be inside <NumberField.Root>.`);
  return context;
}

function Root({
  value,
  defaultValue,
  onValueChange,
  onValueCommitted,
  min,
  max,
  step,
  largeStep,
  smallStep,
  snapOnStep,
  format,
  locale,
  allowWheelScrub,
  allowOutOfRange,
  name,
  form,
  id,
  required,
  disabled,
  readOnly,
  children,
  ...rest
}: NumberFieldRootProps) {
  // The keys, the buttons, scrubbing and commit-time formatting (decision-63).
  numberFieldScript();
  const generated = useId();
  const field = useField();
  const element = ref<NumberFieldElement>();
  // A failed submission's value (a Form's `values`) replaces the default (TASK-430).
  const sent = useFormValues(
    untrack(() => name ?? field?.name()),
    untrack(() => disabled),
  )?.[0];
  const echoed = sent ? Number(sent) : Number.NaN;
  const current = signal<number | null>(
    untrack(() => value ?? (Number.isFinite(echoed) ? echoed : (defaultValue ?? null))),
  );
  // The `value` prop drives the input when it changes.
  effect(() => {
    const next = value;
    if (next === undefined) return;
    current.set(next);
    const host = element();
    // Not the echo of what is being typed: rewriting the text then would format it under the
    // caret ("7." loses its point) and, in Firefox and WebKit, cancel the `change` on blur
    // (TASK-416).
    if (host?.isConnected && host.value !== next) host.value = next;
  });
  const context: NumberFieldContextValue = {
    // Ids do not change.
    inputId: untrack(() => id ?? (field ? controlId(field) : `${generated}-input`)),
    value: current,
    min: () => min,
    max: () => max,
    step: () => step,
    format: () => format,
    locale: () => locale,
    name: () => name ?? field?.name(),
    form: () => form,
    required: () => required,
    disabled: () => disabled === true || field?.disabled() === true,
    readOnly: () => readOnly,
  };
  const report = () => {
    const next = element()?.value ?? null;
    if (next === untrack(current)) return;
    current.set(next);
    onValueChange?.(next);
  };
  // A form reset puts the number back without an `input` event: it is reported (TASK-435).
  onFormReset(
    () => element()?.input ?? undefined,
    () => element()?.value ?? null,
    report,
  );
  return (
    <NumberFieldContext value={context}>
      <lu-number-field
        {...rest}
        ref={element}
        id={generated}
        min={min}
        max={max}
        step={step}
        large-step={largeStep}
        small-step={smallStep}
        snap-on-step={snapOnStep}
        format={format ? JSON.stringify(format) : undefined}
        locale={locale}
        allow-wheel-scrub={allowWheelScrub}
        allow-out-of-range={allowOutOfRange}
        on:input={report}
        on:change={() => {
          report();
          onValueCommitted?.(element()?.value ?? null);
        }}
      >
        <input
          type="hidden"
          form={form}
          value={untrack(() => (format && current() !== null ? String(current()) : undefined))}
        />
        {children}
      </lu-number-field>
    </NumberFieldContext>
  );
}

function Group({ children, ...rest }: NumberFieldGroupProps) {
  useNumberField("Group");
  return <div {...rest}>{children}</div>;
}

function Input(props: NumberFieldInputProps) {
  const field = useNumberField("Input");
  const owner = useField();
  const formatted = untrack(field.format) !== undefined;
  // The server HTML's text; the element keeps it from then on (typing, the keys, the buttons).
  const text = untrack(() => {
    const number = field.value();
    if (number === null) return undefined;
    return formatted
      ? formatNumber(number, formatter(field.format(), field.locale()))
      : String(number);
  });
  const initial = untrack(field.value);
  // The limits follow the field (TASK-477); the value's ARIA is the server HTML's, which the
  // element keeps current from then on, as it does the text.
  const spin = () =>
    formatted
      ? {
          role: "spinbutton",
          "aria-valuenow": initial ?? undefined,
          "aria-valuemin": field.min(),
          "aria-valuemax": field.max(),
          "aria-valuetext": text,
        }
      : { min: field.min(), max: field.max(), step: field.step() };
  return (
    <input
      autocomplete="off"
      spellcheck={false}
      aria-describedby={owner ? describedBy(owner) : undefined}
      aria-invalid={owner?.invalid() ? "true" : undefined}
      {...props}
      {...spin()}
      type={formatted ? "text" : "number"}
      // A minus key where negative numbers are allowed: iOS's decimal keyboard has none (M36).
      inputmode={(field.min() ?? -1) >= 0 ? "decimal" : "text"}
      id={field.inputId}
      name={field.name()}
      form={field.form()}
      value={text}
      required={field.required()}
      readonly={field.readOnly()}
      disabled={props.disabled || field.disabled() || undefined}
    />
  );
}

/** Whether a button stepping toward `limit` is at it. */
function atLimit(field: NumberFieldContextValue, up: boolean): boolean {
  const value = field.value();
  const limit = up ? field.max() : field.min();
  return value !== null && limit !== undefined && (up ? value >= limit : value <= limit);
}

function Increment({ children, ...rest }: NumberFieldIncrementProps) {
  const field = useNumberField("Increment");
  return (
    <button
      type="button"
      tabindex={-1}
      aria-label="Increase"
      {...rest}
      data-action="increment"
      aria-controls={field.inputId}
      disabled={rest.disabled || field.disabled() || field.readOnly() || atLimit(field, true)}
    >
      {children}
    </button>
  );
}

function Decrement({ children, ...rest }: NumberFieldDecrementProps) {
  const field = useNumberField("Decrement");
  return (
    <button
      type="button"
      tabindex={-1}
      aria-label="Decrease"
      {...rest}
      data-action="decrement"
      aria-controls={field.inputId}
      disabled={rest.disabled || field.disabled() || field.readOnly() || atLimit(field, false)}
    >
      {children}
    </button>
  );
}

function ScrubArea({ children, direction, pixelSensitivity, ...rest }: NumberFieldScrubAreaProps) {
  useNumberField("ScrubArea");
  return (
    <span
      {...rest}
      data-scrub=""
      data-direction={direction ?? "horizontal"}
      data-pixel-sensitivity={pixelSensitivity}
    >
      {children}
    </span>
  );
}

/**
 * A number input with buttons to step it, after Base UI's NumberField: the arrow keys, Page Up and
 * Page Down, Home and End, press-and-hold buttons, a scrub area, the wheel when asked, and
 * `Intl.NumberFormat` formatting with parsing back. Native `<input type="number">` unless it is
 * formatted. Unstyled: style the parts through `class`, `:disabled`, `[data-scrubbing]` and
 * `:focus-visible`.
 *
 * @example
 * <NumberField.Root name="quantity" defaultValue={1} min={1} max={99}>
 *   <NumberField.Group>
 *     <NumberField.Decrement>−</NumberField.Decrement>
 *     <NumberField.Input aria-label="Quantity" />
 *     <NumberField.Increment>+</NumberField.Increment>
 *   </NumberField.Group>
 * </NumberField.Root>
 */
export const NumberField = { Root, Group, Input, Increment, Decrement, ScrubArea };
