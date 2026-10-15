// Progress (decision-62, TASK-373): a native `<progress>`, after Base UI's Progress. The element
// is the progress bar for assistive technology (`role="progressbar"`, its value and maximum, and
// `aria-valuetext` with the formatted value), indeterminate when it has no value (`:indeterminate`);
// the Root around it holds the label and the value text, and sets `--lu-value`. No script: a
// progress only changes when the component renders it again.
import { createContext, useContext, useId } from "lumiose";
import { withStyle } from "../placement/placement.ts";
import { formatValue, percent } from "./value.ts";

interface ProgressContextValue {
  id: string;
  value: () => number | null;
  min: () => number;
  max: () => number;
  text: () => string | undefined;
  /** What assistive technology reads: `getAriaValueText`'s, else the formatted value. */
  valueText: () => string | undefined;
}

const ProgressContext = createContext<ProgressContextValue>();

/** `Progress.Root` renders a `<div>` around the parts, with `--lu-value` (0% to 100%). */
export type ProgressRootProps = JSX.HTMLProps<HTMLElement> & {
  /** The progress so far, from `min` to `max`; `null` while it is unknown (indeterminate). */
  value: number | null;
  /** The value at the start. Default `0`. */
  min?: number;
  /** The value when done. Default `100`. */
  max?: number;
  /** How the value is written: `Intl.NumberFormat` options. Default: a percentage of the range. */
  format?: Intl.NumberFormatOptions;
  /** The locale of the formatted value. Default: the browser's (the server's in server HTML). */
  locale?: Intl.LocalesArgument;
  /** The text assistive technology reads for the value. Default: the formatted value. */
  getAriaValueText?: (formattedValue: string, value: number | null) => string;
};

/** The `<label>` of the progress bar. */
export type ProgressLabelProps = JSX.IntrinsicElements["label"];

/**
 * The progress bar: a native `<progress>`, styled with `appearance: none` and its
 * `::-webkit-progress-value` and `::-moz-progress-bar` pseudo-elements, or `--lu-value`.
 */
export type ProgressTrackProps = Omit<JSX.IntrinsicElements["progress"], "value" | "max">;

/** A `<span>` with the formatted value. */
export type ProgressValueProps = Omit<JSX.IntrinsicElements["span"], "children"> & {
  /** Renders the value your way, from the formatted value and the number. */
  children?: (formattedValue: string, value: number | null) => JSX.Element;
};

function useProgress(part: string): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) throw new Error(`Progress.${part} must be inside <Progress.Root>.`);
  return context;
}

function Root({
  value,
  min,
  max,
  format,
  locale,
  getAriaValueText,
  children,
  style,
  ...rest
}: ProgressRootProps) {
  const id = useId();
  const low = () => min ?? 0;
  const high = () => max ?? 100;
  const text = () => {
    const current = value;
    if (current === null) return undefined;
    return formatValue(current, low(), high(), format, locale);
  };
  const valueText = () => {
    const formatted = text();
    if (!getAriaValueText) return formatted;
    return value === null ? undefined : getAriaValueText(formatted ?? "", value);
  };
  const context: ProgressContextValue = {
    id,
    value: () => value,
    min: low,
    max: high,
    text,
    valueText,
  };
  return (
    <ProgressContext value={context}>
      <div
        {...rest}
        style={withStyle(style, {
          "--lu-value": value === null ? undefined : `${percent(value, low(), high())}%`,
        })}
      >
        {children}
      </div>
    </ProgressContext>
  );
}

function Label({ children, ...rest }: ProgressLabelProps) {
  const progress = useProgress("Label");
  return (
    <label {...rest} id={`${progress.id}-label`} for={`${progress.id}-track`}>
      {children}
    </label>
  );
}

function Track(props: ProgressTrackProps) {
  const progress = useProgress("Track");
  const value = () => progress.value();
  return (
    <progress
      {...props}
      id={`${progress.id}-track`}
      // The native element counts from 0: the value's distance from `min`.
      value={value() === null ? undefined : value()! - progress.min()}
      max={progress.max() - progress.min()}
      aria-valuetext={progress.valueText()}
    />
  );
}

function Value({ children, ...rest }: ProgressValueProps) {
  const progress = useProgress("Value");
  return (
    <span {...rest}>
      {children ? children(progress.text() ?? "", progress.value()) : progress.text()}
    </span>
  );
}

/**
 * A progress bar: a task's progress, or an indeterminate one while it is unknown. Native
 * `<progress>`, with a label and the value as text. Unstyled: style it through `class`,
 * `:indeterminate` and `--lu-value`.
 *
 * @example
 * <Progress.Root value={uploaded()}>
 *   <Progress.Label>Uploading</Progress.Label>
 *   <Progress.Value />
 *   <Progress.Track />
 * </Progress.Root>
 */
export const Progress = { Root, Label, Track, Value };
