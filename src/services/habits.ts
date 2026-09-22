/**
 * What the UI may ask about habits (SPECS §2.1, §4.4).
 *
 * The streak count is the only statistic the app exposes anywhere (§1.1 item 7), and
 * this module is the only place it comes from.
 */

import type { HabitState } from '../data/habits.ts';
import { stateFor, toggleToday } from '../data/habits.ts';
import type { Item } from '../data/types.ts';
import type { AppContext } from './database.ts';

export type { HabitState } from '../data/habits.ts';

/**
 * Load the state of every habit in a list of items, keyed by id.
 *
 * Non-habit items are skipped rather than given an empty state, so a caller that looks
 * one up for the wrong type gets `undefined` and not a plausible-looking zero.
 */
export async function loadHabitStates(
  context: AppContext,
  items: readonly Item[],
): Promise<Map<string, HabitState>> {
  const habits = items.filter((item) => item.type === 'habit');
  const states = await Promise.all(
    habits.map(async function stateOf(habit) {
      return [habit.id, await stateFor(context.driver, habit.id)] as const;
    }),
  );
  return new Map(states);
}

/** One tap logs today; tapping again the same day undoes it (SPECS §2.1). */
export async function toggleHabitToday(context: AppContext, habitId: string): Promise<HabitState> {
  return toggleToday(context.driver, habitId);
}
