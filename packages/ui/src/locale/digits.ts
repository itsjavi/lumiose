// Decimal digits of any script as ASCII (TASK-440, M34): full-width `１`, Arabic-Indic `٤`,
// Devanagari `४`… A phone's keyboard or an IME may type them into a number. Number Field's
// `parseNumber` uses it; OTP Field's script keeps a copy (a shared module would be a chunk of its
// own).

const DIGIT = /\p{Nd}/u;

/**
 * The value of a decimal digit (`\p{Nd}`), else `undefined`. Unicode encodes each script's digits
 * as runs of ten, 0 to 9, in order: the count of digits before it in its run, modulo ten.
 */
export function digitValue(char: string): number | undefined {
  if (!DIGIT.test(char)) return undefined;
  let code = char.codePointAt(0)!;
  let index = 0;
  while (DIGIT.test(String.fromCodePoint(code - 1))) {
    code--;
    index++;
  }
  return index % 10;
}
