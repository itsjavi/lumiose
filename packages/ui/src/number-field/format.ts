// A number field's values as text and back, shared by the component (server HTML, islands) and its
// script: `Intl.NumberFormat` writes them, and `parseNumber` reads what a person typed in the same
// locale and format (grouping, the decimal sign, the locale's digits, a currency, a percent sign).
import { digitValue } from "../locale/digits.ts";

/** The formatter for `format` (`Intl.NumberFormat` options) and `locale`. */
export function formatter(
  format: Intl.NumberFormatOptions | undefined,
  locale: Intl.LocalesArgument | null | undefined,
): Intl.NumberFormat {
  return new Intl.NumberFormat(locale ?? undefined, format);
}

/** `value` as the field shows it: `""` for no value. */
export function formatNumber(value: number | null, numbers: Intl.NumberFormat): string {
  return value === null || !Number.isFinite(value) ? "" : numbers.format(value);
}

/** The signs `numbers` writes: its decimal sign and its digits, 0 to 9. */
function signs(numbers: Intl.NumberFormat) {
  const { locale, numberingSystem } = numbers.resolvedOptions();
  const plain = new Intl.NumberFormat(locale, { numberingSystem, useGrouping: false });
  const decimal =
    numbers.formatToParts(1.5).find((part) => part.type === "decimal")?.value ??
    plain.formatToParts(1.5).find((part) => part.type === "decimal")?.value ??
    ".";
  const digits = new Map<string, string>();
  for (let digit = 0; digit <= 9; digit++) digits.set(plain.format(digit), String(digit));
  return { decimal, digits };
}

/**
 * The number in `text`, as typed in `numbers`' locale and format: `null` when it is empty, `NaN`
 * when it holds no number. Grouping, currency and unit signs and spaces are skipped; the locale's
 * decimal sign (or a `.`) marks the fraction; a minus sign or parentheses make it negative; with
 * the percent style, `50 %` is `0.5`.
 */
export function parseNumber(text: string, numbers: Intl.NumberFormat): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const { decimal, digits } = signs(numbers);
  let normalized = "";
  let negative = false;
  let fraction = false;
  for (const char of trimmed) {
    if (/\d/.test(char)) normalized += char;
    else if (digits.has(char)) normalized += digits.get(char);
    // Digits of another script (full-width `１`, `٤`): what a keyboard or an IME may type (M34).
    else if (digitValue(char) !== undefined) normalized += String(digitValue(char));
    else if ((char === decimal || (char === "." && decimal !== ",")) && !fraction) {
      normalized += ".";
      fraction = true;
    } else if (char === "-" || char === "−" || char === "(") negative = true;
  }
  if (!/\d/.test(normalized)) return Number.NaN;
  const value = Number(normalized) * (negative ? -1 : 1);
  return numbers.resolvedOptions().style === "percent" ? value / 100 : value;
}
