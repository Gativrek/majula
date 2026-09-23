/**
 * Numbers as typed on a phone keyboard, shared by recipe quantities and workout loads.
 *
 * Accepts `.` or `,` as the decimal separator, because the owner types on a keyboard that
 * may offer either. That makes `1.000` and `2,500` ambiguous — a thousand or one, two and
 * a half or two thousand five hundred — so they are refused rather than guessed. Guessing
 * wrong turns a kilo of flour into a gram, or a 22.5 kg load into 22,500, with nothing on
 * screen to say so.
 */

/**
 * A separator followed by exactly three digits, after one to three digits that do not
 * start with zero. In English `1.000` is one and `1,000` is a thousand; in Portuguese it
 * is the other way round. Nothing in the input says which the owner meant.
 */
const AMBIGUOUS_QUANTITY = /^[1-9]\d{0,2}[.,]\d{3}$/;

export type ParsedQuantity = number | undefined | 'invalid' | 'ambiguous';

/**
 * @returns the number; `undefined` for a blank field; `'invalid'` when it is not a number;
 * `'ambiguous'` when it is a number in one convention and a different one in the other.
 */
export function parseQuantity(raw: string): ParsedQuantity {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (AMBIGUOUS_QUANTITY.test(trimmed)) return 'ambiguous';
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : 'invalid';
}

/** The message for a quantity that could not be read, naming the field it came from. */
export function quantityProblem(
  parsed: 'invalid' | 'ambiguous',
  subject: string,
  raw: string,
): string {
  return parsed === 'ambiguous'
    ? `${subject} "${raw.trim()}" could mean two different numbers. Write it without the separator, or with fewer digits after it.`
    : `${subject} is not a number.`;
}
