import type { ItemOfType } from '../data/types.ts';
import type { HabitState } from '../services/habits.ts';
import { Icon } from './Icon.tsx';
import { streakText } from './streak-text.ts';
import { useSwipeReveal } from './use-swipe-reveal.ts';

/**
 * A habit row in the Habits list and under Deleted: the name, the current streak, and
 * one control that logs today (`docs/modules/habits.md`). Day to day, habits are logged
 * from the cards above the list; this row is where one is deleted or restored.
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
  const swipe = useSwipeReveal(!isDeleted);
  const checkedToday = state?.checkedToday ?? false;

  return (
    <li class={checkedToday ? 'row row--logged' : 'row'}>
      {isDeleted ? null : (
        <button
          type="button"
          class="row__delete"
          aria-label={`Delete ${habit.title}`}
          tabIndex={swipe.open ? 0 : -1}
          onClick={() => onDelete(habit)}
        >
          <Icon name="trash" size={20} />
          Delete
        </button>
      )}
      <div
        class={swipe.dragging ? 'row__face row__face--dragging' : 'row__face'}
        style={{ transform: `translateX(${swipe.offset}px)` }}
        {...swipe.handlers}
      >
        {isDeleted ? (
          <span class="tile">
            <Icon name="habit" label="Habit" />
          </span>
        ) : (
          <button
            type="button"
            class="habit-toggle"
            aria-pressed={checkedToday}
            aria-label={checkedToday ? 'Undo today' : 'Log today'}
            onClick={() => onToggleToday(habit)}
          >
            <Icon name="flame" />
          </button>
        )}
        <div class="row__text">
          <span class="row__title">{habit.title}</span>
          <span class="row__meta">{streakText(state?.streak ?? 0)}</span>
        </div>
        {isDeleted && onRestore !== undefined ? (
          <button
            type="button"
            class="icon-button icon-button--accent"
            aria-label={`Restore ${habit.title}`}
            onClick={() => onRestore(habit)}
          >
            <Icon name="restore" />
          </button>
        ) : null}
      </div>
    </li>
  );
}
