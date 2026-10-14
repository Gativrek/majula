import type { ItemOfType } from '../data/types.ts';
import type { HabitState } from '../services/habits.ts';
import { Icon } from './Icon.tsx';
import { dayUnit } from './streak-text.ts';

/**
 * Habits above the list, on every category: one card each, and tapping a card logs today
 * or undoes it (`docs/modules/habits.md` criteria 3–4). A card logged today is outlined in
 * gold. The heading opens the Habits list, which is where a habit is deleted.
 *
 * With no habits there is nothing here at all, so the list keeps the space.
 */

interface HabitStripProps {
  habits: readonly ItemOfType<'habit'>[];
  states: ReadonlyMap<string, HabitState>;
  onToggleToday: (habit: ItemOfType<'habit'>) => void;
  onShowAll: () => void;
}

export function HabitStrip({ habits, states, onToggleToday, onShowAll }: HabitStripProps) {
  if (habits.length === 0) return null;
  const logged = habits.filter((habit) => states.get(habit.id)?.checkedToday === true).length;

  return (
    <section class="section">
      <div class="section__head">
        <h2 class="kicker">Habits today</h2>
        <button type="button" class="section__link" onClick={onShowAll}>
          {`${logged} of ${habits.length} logged`}
        </button>
      </div>
      <div class="habit-cards">
        {habits.map(function card(habit) {
          const state = states.get(habit.id);
          const streak = state?.streak ?? 0;
          const checked = state?.checkedToday ?? false;
          return (
            <button
              key={habit.id}
              type="button"
              class="habit-card"
              aria-pressed={checked}
              aria-label={`${habit.title}, streak ${streak} ${dayUnit(streak)}${checked ? ', logged today' : ''}`}
              onClick={() => onToggleToday(habit)}
            >
              <span class="habit-card__streak">
                <Icon name="flame" size={18} />
                <span class="habit-card__number">{streak}</span>
                <span class="habit-card__unit">{dayUnit(streak)}</span>
              </span>
              <span class="habit-card__name">{habit.title}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
