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
  const formatter = numberFormat(locale ?? undefined, options);
  return values.map((value) => formatter.format(value));
}

/**
 * Options the browser refuses (`{"style":"currency"}` without a currency) are left out, and then
 * an invalid locale, so the slider still works (TASK-473, L12); the server falls back the same way.
 */
function numberFormat(locale: string | undefined, options: Intl.NumberFormatOptions | undefined) {
  try {
    return new Intl.NumberFormat(locale, options);
  } catch {
    try {
      return new Intl.NumberFormat(locale);
    } catch {
      return new Intl.NumberFormat();
    }
  }
}
