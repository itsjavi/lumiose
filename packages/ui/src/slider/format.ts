// The slider's values as text, shared by the component (server HTML, islands) and its script.

/** The values written with `format` (`Intl.NumberFormat` options as JSON) and `locale`. */
export function formatValues(
  values: readonly number[],
  format: string | null,
  locale: string | null,
): string[] {
  let options: Intl.NumberFormatOptions | undefined;
  try {
    options = format ? (JSON.parse(format) as Intl.NumberFormatOptions) : undefined;
  } catch {
    options = undefined;
  }
  const formatter = new Intl.NumberFormat(locale ?? undefined, options);
  return values.map((value) => formatter.format(value));
}
