import type { ItemOfType } from '../data/types.ts';
import type { HabitState } from '../services/habits.ts';

/**
 * A habit row: the name, the current streak, and one control that logs today
 * (`docs/modules/habits.md`).
 *
 * The streak number is the only statistic in the app (SPECS §1.1 item 7). There is
 * deliberately nowhere to see a history, a rate or a record.
 */

interface HabitRowProps {
  habit: ItemOfType<'habit'>;
  state: HabitState | undefined;
  onToggleToday: (habit: ItemOfType<'habit'>) => void;
  onDelete: (habit: ItemOfType<'habit'>) => void;
  onRestore?: (habit: ItemOfType<'habit'>) => void;
}

export function HabitRow({ habit, state, onToggleToday, onDelete, onRestore }: HabitRowProps) {
  const isDeleted = habit.deletedAt !== null;
  const streak = state?.streak ?? 0;
  const checkedToday = state?.checkedToday ?? false;

  return (
    <li class={checkedToday ? 'item item--checked-today' : 'item'}>
      {isDeleted ? null : (
        <button
          type="button"
          class="habit__check"
          aria-pressed={checkedToday}
          aria-label={checkedToday ? 'Undo today' : 'Log today'}
          onClick={() => onToggleToday(habit)}
        >
          {checkedToday ? '✓' : '·'}
        </button>
      )}

      <div class="item__content">
        <div class="item__title">{habit.title}</div>
        <div class="item__meta">
          {/* Plural handled here rather than in JSX logic, because "1 days" is the kind
              of thing that survives review and then annoys forever. */}
          {streak === 1 ? 'Streak 1 day' : `Streak ${streak} days`}
        </div>
      </div>

      <div class="item__actions">
        {isDeleted && onRestore !== undefined ? (
          <button
            type="button"
            class="icon-button"
            aria-label="Restore"
            onClick={() => onRestore(habit)}
          >
            {'↺'}
          </button>
        ) : (
          <button
            type="button"
            class="icon-button"
            aria-label="Delete"
            onClick={() => onDelete(habit)}
          >
            {'×'}
          </button>
        )}
      </div>
    </li>
  );
}
