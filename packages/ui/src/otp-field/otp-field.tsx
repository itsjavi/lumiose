// OTP Field (decision-62, TASK-376): a one-time code input, after Base UI's OTPField. Unlike Base UI
// (one input per character), it is one native `<input>` under visual slots: SMS autofill
// (`autocomplete="one-time-code"`) puts the whole code in one field, paste, Backspace and the arrow
// keys work as in any text field, `maxlength`, `pattern` and `required` validate it and the form
// submits it, without JavaScript too; and assistive technology meets one labelled text field
// rather than a field per character. Root renders `<lu-otp-field>`, whose script
// (otp-field.script.ts) keeps the value to the allowed characters and shows it in the slots. The
// `value` prop drives it when it changes; the input's `input` events and the element's
// `valuecomplete` and `valueinvalid` report back.
import { createContext, effect, ref, untrack, useContext, useId } from "lumiose";
import { controlId, describedBy, useField } from "../field/context.ts";
import { onFormReset } from "../form/reset.ts";
import type { OTPFieldElement, OTPFieldValueDetail } from "./otp-field.script.ts";
import otpFieldScript from "./otp-field.script.ts?client";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * OTP Field's element. Attributes `length`, `validation-type`, `mask`, `auto-submit`;
       * property `value`; events `valuecomplete` and `valueinvalid` (`detail.value`).
       */
      "lu-otp-field": JSX.HTMLProps<OTPFieldElement> & {
        length?: number;
        "validation-type"?: OTPFieldValidationType;
        mask?: boolean;
        "auto-submit"?: boolean;
      };
    }
  }
}

/** The characters a code may hold. */
export type OTPFieldValidationType = "numeric" | "alpha" | "alphanumeric" | "none";

/**
 * The element props Root passes to `<lu-otp-field>`, without the brand of intrinsic elements'
 * props, so that `bind:value` applies to Root.
 */
type ElementProps = {
  [
    K in keyof JSX.HTMLProps<OTPFieldElement> as K extends string ? K : never
  ]: JSX.HTMLProps<OTPFieldElement>[K];
};

/**
 * `OTPField.Root` renders `<lu-otp-field>` around the input and the slots. `bind:value={signal}`
 * stands in for `value` and `onValueChange`.
 */
export interface OTPFieldRootProps extends Omit<
  ElementProps,
  "children" | "onChange" | "onInput" | "id"
> {
  /** How many characters the code has. */
  length: number;
  /** Shows this code when it changes. Pair it with `onValueChange`. */
  value?: string;
  /** The code at first, when `value` is left out; a form reset goes back to it. */
  defaultValue?: string;
  /** Called as the code changes: typing, a paste, autofill, Backspace. */
  onValueChange?: (value: string) => void;
  /** Called when the last character is entered, with the whole code. */
  onValueComplete?: (value: string) => void;
  /** Called with what was entered when it held characters the field does not allow. */
  onValueInvalid?: (value: string) => void;
  /** The characters the code may hold. Default `"numeric"` (digits). */
  validationType?: OTPFieldValidationType;
  /**
   * Normalizes what is entered before the allowed characters are kept: `(text) =>
   * text.toUpperCase()`, say. In an island: a server page's script cannot receive a function.
   */
  normalizeValue?: (value: string) => string;
  /** The virtual keyboard: default `"numeric"` for digits, `"text"` otherwise. */
  inputMode?: "numeric" | "text" | "tel" | "none";
  /** The slots show dots instead of the characters. */
  mask?: boolean;
  /** The input's `autocomplete`. Default `"one-time-code"`: the browser offers a code it received. */
  autoComplete?: string;
  /** Submits the form when the last character is entered. */
  autoSubmit?: boolean;
  /** The name the code is submitted under. */
  name?: string;
  /** The id of a form the field belongs to, when it is outside it. */
  form?: string;
  /** The input's id, for a `<label for>`. Default: generated, or the Field's. */
  id?: string;
  /** The form needs a whole code. */
  required?: boolean;
  /** The field cannot be used. */
  disabled?: boolean;
  /** The code can be read and submitted, not changed. */
  readOnly?: boolean;
  /** The `Input` and the `Slot`s (with `Separator`s between them). */
  children?: JSX.Element;
}

/**
 * The `<input>` that holds the code: over the slots, its text transparent, once the script runs; a
 * plain text field without it. Name it with a label or `aria-label`.
 */
export type OTPFieldInputProps = Omit<
  JSX.IntrinsicElements["input"],
  | "type"
  | "value"
  | "name"
  | "form"
  | "required"
  | "readonly"
  | "maxlength"
  | "minlength"
  | "pattern"
  | "inputmode"
  | "autocomplete"
  | "id"
>;

/** A `<div aria-hidden="true">` that shows one character of the code, the next in order. */
export type OTPFieldSlotProps = Omit<JSX.IntrinsicElements["div"], "children">;

/** A `<div aria-hidden="true">` between slots: a dash, a gap. */
export type OTPFieldSeparatorProps = JSX.IntrinsicElements["div"] & {
  /** Which way it runs. Default `"horizontal"`. */
  orientation?: "horizontal" | "vertical";
};

interface OTPFieldContextValue {
  inputId: string;
  length: () => number;
  initial: string;
  validationType: () => OTPFieldValidationType;
  inputMode: () => string;
  mask: () => boolean;
  autoComplete: () => string;
  name: () => string | undefined;
  form: () => string | undefined;
  required: () => boolean | undefined;
  disabled: () => boolean;
  readOnly: () => boolean | undefined;
  /** How many slots have rendered: the next slot's index. */
  slots: { count: number };
}

const OTPFieldContext = createContext<OTPFieldContextValue>();

function useOTPField(part: string): OTPFieldContextValue {
  const context = useContext(OTPFieldContext);
  if (!context) throw new Error(`OTPField.${part} must be inside <OTPField.Root>.`);
  return context;
}

/** The `pattern` that matches a whole code of `length` characters of `type`. */
function pattern(type: OTPFieldValidationType, length: number): string {
  const char = {
    numeric: "\\p{Nd}",
    alpha: "\\p{L}",
    alphanumeric: "[\\p{L}\\p{Nd}]",
    none: "\\S",
  }[type];
  return `${char}{${length}}`;
}

function Root({
  length,
  value,
  defaultValue,
  onValueChange,
  onValueComplete,
  onValueInvalid,
  validationType,
  normalizeValue,
  inputMode,
  mask,
  autoComplete,
  autoSubmit,
  name,
  form,
  id,
  required,
  disabled,
  readOnly,
  children,
  ...rest
}: OTPFieldRootProps) {
  // Cleans the value and shows it in the slots, on server pages and in islands (decision-63).
  otpFieldScript();
  const generated = useId();
  const field = useField();
  const element = ref<OTPFieldElement>();
  const type = () => validationType ?? "numeric";
  // The `value` prop drives the code when it changes.
  effect(() => {
    const next = value;
    const host = element();
    if (next !== undefined && host?.isConnected && host.value !== next) host.value = next;
  });
  effect(() => {
    const host = element();
    if (host) host.normalizeValue = normalizeValue;
  });
  // A form reset puts the code back without an `input` event: it goes to `onValueChange`
  // (TASK-435).
  if (onValueChange) {
    onFormReset(
      () => element()?.input ?? undefined,
      () => element()!.value,
      onValueChange,
    );
  }
  const context: OTPFieldContextValue = {
    inputId: untrack(() => id ?? (field ? controlId(field) : `${generated}-input`)),
    length: () => length,
    initial: untrack(() => value ?? defaultValue ?? ""),
    validationType: type,
    inputMode: () => inputMode ?? (type() === "numeric" ? "numeric" : "text"),
    mask: () => mask === true,
    autoComplete: () => autoComplete ?? "one-time-code",
    name: () => name ?? field?.name(),
    form: () => form,
    required: () => required,
    disabled: () => disabled === true || field?.disabled() === true,
    readOnly: () => readOnly,
    slots: { count: 0 },
  };
  return (
    <OTPFieldContext value={context}>
      <lu-otp-field
        {...rest}
        ref={element}
        // Digits read left to right in right-to-left pages too: a numeric code's slots run that
        // way unless `dir` says otherwise (TASK-385). Letters follow the page.
        dir={rest.dir ?? (type() === "numeric" ? "ltr" : undefined)}
        length={length}
        validation-type={type()}
        mask={mask}
        auto-submit={autoSubmit}
        on:input={(event: Event) => {
          const input = element()?.input;
          // A composition reports once committed (the element fires `input` then, TASK-432).
          if (input && event.target === input && !(event as InputEvent).isComposing) {
            onValueChange?.(input.value);
          }
        }}
        on:valuecomplete={(event: CustomEvent<OTPFieldValueDetail>) =>
          onValueComplete?.(event.detail.value)
        }
        on:valueinvalid={(event: CustomEvent<OTPFieldValueDetail>) =>
          onValueInvalid?.(event.detail.value)
        }
      >
        {children}
      </lu-otp-field>
    </OTPFieldContext>
  );
}

function Input(props: OTPFieldInputProps) {
  const otp = useOTPField("Input");
  const field = useField();
  return (
    <input
      spellcheck={false}
      autocapitalize="off"
      aria-describedby={field ? describedBy(field) : undefined}
      aria-invalid={field?.invalid() ? "true" : undefined}
      {...props}
      type="text"
      id={otp.inputId}
      name={otp.name()}
      form={otp.form()}
      value={otp.initial || undefined}
      inputmode={otp.inputMode() as JSX.IntrinsicElements["input"]["inputmode"]}
      autocomplete={otp.autoComplete() as JSX.IntrinsicElements["input"]["autocomplete"]}
      maxlength={otp.length()}
      minlength={otp.length()}
      pattern={pattern(otp.validationType(), otp.length())}
      required={otp.required()}
      readonly={otp.readOnly()}
      disabled={props.disabled || otp.disabled() || undefined}
    />
  );
}

function Slot(props: OTPFieldSlotProps) {
  const otp = useOTPField("Slot");
  const index = otp.slots.count++;
  // The server HTML's character; the script keeps it from then on.
  const char = untrack(() => otp.initial[index] ?? "");
  return (
    <div {...props} aria-hidden="true" data-slot="" data-filled={char ? "" : undefined}>
      {char && otp.mask() ? "•" : char}
    </div>
  );
}

function Separator({ orientation, ...rest }: OTPFieldSeparatorProps) {
  useOTPField("Separator");
  return <div {...rest} aria-hidden="true" data-orientation={orientation ?? "horizontal"} />;
}

/**
 * A one-time code field: one native input, shown as one slot per character, with SMS autofill,
 * paste, validation of the allowed characters and the form's value. Unstyled: style the parts
 * through `class`, the slots' `[data-filled]` and `[data-active]`, and the root's
 * `[data-complete]` and `[data-focused]`.
 *
 * @example
 * <OTPField.Root length={6} name="code">
 *   <OTPField.Input aria-label="Verification code" />
 *   <OTPField.Slot />
 *   <OTPField.Slot />
 *   <OTPField.Slot />
 *   <OTPField.Separator />
 *   <OTPField.Slot />
 *   <OTPField.Slot />
 *   <OTPField.Slot />
 * </OTPField.Root>
 */
export const OTPField = { Root, Input, Slot, Separator };
