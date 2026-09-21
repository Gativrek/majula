/**
 * UUID v4 identifiers (SPECS §4.1), injected rather than called inline so exports and
 * migrations can be tested deterministically (CODESTYLE §6).
 */

export type IdGenerator = () => string;

export const randomId: IdGenerator = function randomId() {
  return crypto.randomUUID();
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
