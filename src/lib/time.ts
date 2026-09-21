/**
 * Two distinct time types (SPECS §4.1, CODESTYLE §10).
 *
 * `Timestamp` is an ISO 8601 UTC instant, used for `created_at`, `updated_at` and
 * `deleted_at`. `LocalDate` is a calendar day in the device's timezone, used only for
 * habit check-ins. They are branded so the compiler refuses to pass one where the
 * other belongs — the streak logic depends on that distinction and a silent swap
 * would only surface as a wrong number, never as a crash.
 */

declare const timestampBrand: unique symbol;
declare const localDateBrand: unique symbol;

/** ISO 8601 UTC, e.g. `2026-09-21T14:03:00.000Z`. */
export type Timestamp = string & { readonly [timestampBrand]: true };

/** `YYYY-MM-DD` in the device's local timezone. */
export type LocalDate = string & { readonly [localDateBrand]: true };

const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A source of the current instant, injected so tests are deterministic (CODESTYLE §6). */
export type Clock = () => Date;

export const systemClock: Clock = function systemClock() {
  return new Date();
};

export function nowTimestamp(clock: Clock = systemClock): Timestamp {
  return clock().toISOString() as Timestamp;
}

/** The device's current calendar day, not the UTC one. */
export function todayLocalDate(clock: Clock = systemClock): LocalDate {
  return toLocalDate(clock());
}

export function toLocalDate(date: Date): LocalDate {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as LocalDate;
}

export function isTimestamp(value: unknown): value is Timestamp {
  return typeof value === 'string' && TIMESTAMP_PATTERN.test(value);
}

export function isLocalDate(value: unknown): value is LocalDate {
  return typeof value === 'string' && LOCAL_DATE_PATTERN.test(value);
}

/**
 * The previous calendar day. Built by arithmetic on the local date parts rather than
 * by subtracting 86_400_000 ms, which lands on the wrong day across a DST boundary.
 */
export function previousLocalDate(date: LocalDate): LocalDate {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const shifted = new Date(year, month - 1, day - 1);
  return toLocalDate(shifted);
}
