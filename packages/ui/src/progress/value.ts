// What Progress, Meter and Slider show for a value: Base UI's formatting (a percentage of the range
// by default, or `Intl.NumberFormat` options), and the `--lu-value` custom property (the value's
// place in the range, as a percentage) that styles a bar or an indicator.

/** The value's place between `min` and `max`, from 0 to 100. */
export function percent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

/** The value as text: a percentage of the range, or formatted with `format` when given. */
export function formatValue(
  value: number,
  min: number,
  max: number,
  format: Intl.NumberFormatOptions | undefined,
  locale: Intl.LocalesArgument,
): string {
  if (format) return new Intl.NumberFormat(locale, format).format(value);
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(
    percent(value, min, max) / 100,
  );
}
