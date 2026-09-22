/**
 * The streak walk (SPECS §4.4).
 *
 * Pure: it takes the check-in dates and the date the device thinks it is, and returns a
 * number. No SQL and no clock of its own, so every calendar case that matters — a
 * midnight rollover, a timezone change, a DST boundary — is a test rather than a thing
 * to reason about once and hope.
 */

import type { LocalDate } from '../lib/time.ts';
import { previousLocalDate } from '../lib/time.ts';

/**
 * Count consecutive local dates ending today, or yesterday if today is not yet checked.
 *
 * The "or yesterday" clause is not a grace period. It is what stops a streak reading zero
 * all morning, before the habit has been done; missing a whole day still resets it to
 * zero (§4.4).
 *
 * @param checkedDates every date this habit was checked, in any order.
 * @param today the device's current local date.
 * @returns the current streak, zero if it is broken.
 */
export function currentStreak(checkedDates: Iterable<LocalDate>, today: LocalDate): number {
  const checked = new Set<string>(checkedDates);
  const yesterday = previousLocalDate(today);

  let cursor: LocalDate;
  if (checked.has(today)) {
    cursor = today;
  } else if (checked.has(yesterday)) {
    cursor = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (checked.has(cursor)) {
    streak += 1;
    cursor = previousLocalDate(cursor);
  }
  return streak;
}
