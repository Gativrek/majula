/**
 * Habit check-ins (SPECS §2.1, §4.4). Every statement against `habit_checks` lives here.
 *
 * Check-in dates are local `YYYY-MM-DD` and are never passed to a timestamp helper
 * (§4.1, CODESTYLE §10). A check-in records the day it was made in the timezone the
 * phone was in, and that string never moves afterwards.
 */

import { log } from '../lib/logger.ts';
import type { Clock, LocalDate } from '../lib/time.ts';
import { systemClock, todayLocalDate } from '../lib/time.ts';
import type { SqlDriver } from './driver.ts';
import { currentStreak } from './streak.ts';

/** Every date a habit was checked, newest first. */
export async function listChecks(driver: SqlDriver, habitId: string): Promise<LocalDate[]> {
  const rows = await driver.query<{ date: string }>(
    'SELECT date FROM habit_checks WHERE habit_id = ? ORDER BY date DESC',
    [habitId],
  );
  return rows.map((row) => row.date as LocalDate);
}

export async function isCheckedOn(
  driver: SqlDriver,
  habitId: string,
  date: LocalDate,
): Promise<boolean> {
  const rows = await driver.query<{ count: number }>(
    'SELECT COUNT(*) AS count FROM habit_checks WHERE habit_id = ? AND date = ?',
    [habitId, date],
  );
  return (rows[0]?.count ?? 0) > 0;
}

export async function streakFor(
  driver: SqlDriver,
  habitId: string,
  clock: Clock = systemClock,
): Promise<number> {
  return currentStreak(await listChecks(driver, habitId), todayLocalDate(clock));
}

export interface HabitState {
  checkedToday: boolean;
  streak: number;
}

export async function stateFor(
  driver: SqlDriver,
  habitId: string,
  clock: Clock = systemClock,
): Promise<HabitState> {
  const today = todayLocalDate(clock);
  const checks = await listChecks(driver, habitId);
  return {
    checkedToday: checks.includes(today),
    streak: currentStreak(checks, today),
  };
}

/**
 * Log today, or undo it if today is already logged (SPECS §2.1).
 *
 * This is a toggle rather than an increment, so the interface has one control and no way
 * to double-count. The composite primary key makes the insert idempotent regardless.
 *
 * @returns the habit's state after the toggle.
 */
export async function toggleToday(
  driver: SqlDriver,
  habitId: string,
  clock: Clock = systemClock,
): Promise<HabitState> {
  const today = todayLocalDate(clock);

  await driver.transaction(async function toggleCheck() {
    if (await isCheckedOn(driver, habitId, today)) {
      await driver.run('DELETE FROM habit_checks WHERE habit_id = ? AND date = ?', [
        habitId,
        today,
      ]);
      log.info('habit.unchecked', { id: habitId });
    } else {
      await driver.run('INSERT INTO habit_checks (habit_id, date) VALUES (?, ?)', [habitId, today]);
      log.info('habit.checked', { id: habitId });
    }
  });

  return stateFor(driver, habitId, clock);
}
