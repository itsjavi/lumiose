// Meter (decision-62, TASK-373): a native `<meter>`, after Base UI's Meter: a measurement within a
// known range (disk usage, a password's strength), not a task's progress. The element carries the
// role, the range and `aria-valuetext` with the formatted value; its native `low`, `high` and
// `optimum` pass through. The Root around it holds the label and the value text, and sets
// `--lu-value`. No script.
import { createContext, useContext, useId } from "lumiose";
import { withStyle } from "../placement/placement.ts";
import { formatValue, percent } from "../progress/value.ts";

interface MeterContextValue {
  id: string;
  value: () => number;
  min: () => number;
  max: () => number;
  text: () => string;
  valueText: () => string;
}

const MeterContext = createContext<MeterContextValue>();

/** `Meter.Root` renders a `<div>` around the parts, with `--lu-value` (0% to 100%). */
export type MeterRootProps = JSX.HTMLProps<HTMLElement> & {
  /** The measured value, from `min` to `max`. */
  value: number;
  /** The bottom of the range. Default `0`. */
  min?: number;
  /** The top of the range. Default `100`. */
  max?: number;
  /** How the value is written: `Intl.NumberFormat` options. Default: a percentage of the range. */
  format?: Intl.NumberFormatOptions;
  /** The locale of the formatted value. Default: the browser's (the server's in server HTML). */
  locale?: Intl.LocalesArgument;
  /** The text assistive technology reads for the value. Default: the formatted value. */
  getAriaValueText?: (formattedValue: string, value: number) => string;
};

/** The `<label>` of the meter. */
export type MeterLabelProps = JSX.IntrinsicElements["label"];

/**
 * The meter: a native `<meter>` with the Root's value and range, plus the native `low`, `high`
 * and `optimum`. Styled with `appearance: none` and its `::-webkit-meter-*` and `::-moz-meter-bar`
 * pseudo-elements, or `--lu-value`.
 */
export type MeterTrackProps = Omit<JSX.IntrinsicElements["meter"], "value" | "min" | "max">;

/** A `<span>` with the formatted value. */
export type MeterValueProps = Omit<JSX.IntrinsicElements["span"], "children"> & {
  /** Renders the value your way, from the formatted value and the number. */
  children?: (formattedValue: string, value: number) => JSX.Element;
};

function useMeter(part: string): MeterContextValue {
  const context = useContext(MeterContext);
  if (!context) throw new Error(`Meter.${part} must be inside <Meter.Root>.`);
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
}: MeterRootProps) {
  const id = useId();
  const low = () => min ?? 0;
  const high = () => max ?? 100;
  const text = () => formatValue(value, low(), high(), format, locale);
  const context: MeterContextValue = {
    id,
    value: () => value,
    min: low,
    max: high,
    text,
    valueText: () => (getAriaValueText ? getAriaValueText(text(), value) : text()),
  };
  return (
    <MeterContext value={context}>
      <div
        {...rest}
        style={withStyle(style, { "--lu-value": `${percent(value, low(), high())}%` })}
      >
        {children}
      </div>
    </MeterContext>
  );
}

function Label({ children, ...rest }: MeterLabelProps) {
  const meter = useMeter("Label");
  return (
    <label {...rest} id={`${meter.id}-label`} for={`${meter.id}-track`}>
      {children}
    </label>
  );
}

function Track(props: MeterTrackProps) {
  const meter = useMeter("Track");
  return (
    <meter
      {...props}
      id={`${meter.id}-track`}
      value={meter.value()}
      min={meter.min()}
      max={meter.max()}
      aria-valuetext={meter.valueText()}
    />
  );
}

function Value({ children, ...rest }: MeterValueProps) {
  const meter = useMeter("Value");
  return <span {...rest}>{children ? children(meter.text(), meter.value()) : meter.text()}</span>;
}

/**
 * A measurement within a range, as a native `<meter>`, with a label and the value as text.
 * Unstyled: style it through `class`, the meter's pseudo-elements and `--lu-value`.
 *
 * @example
 * <Meter.Root value={72}>
 *   <Meter.Label>Storage used</Meter.Label>
 *   <Meter.Value />
 *   <Meter.Track />
 * </Meter.Root>
 */
export const Meter = { Root, Label, Track, Value };
