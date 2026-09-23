import type { Item, ItemOfType } from '../data/types.ts';
import type { HabitState } from '../services/habits.ts';
import { HabitRow } from './HabitRow.tsx';
import { ItemRow } from './ItemRow.tsx';

/**
 * The one list view (ROADMAP Phase 1). Type and tag views are filters over this same
 * list, not screens of their own (SPECS §2.2).
 *
 * Habits get their own row because they carry a streak and a today-toggle instead of a
 * done flag. Everything else shares one row.
 */

/** Types that open into a screen of their own when tapped. */
const OPENABLE_TYPES: readonly Item['type'][] = [
  'recipe',
  'reading',
  'place',
  'routine',
  'workout_log',
  'exercise',
];

interface ItemListProps {
  items: readonly Item[];
  emptyMessage: string;
  habitStates: ReadonlyMap<string, HabitState>;
  onToggleDone: (item: Item) => void;
  onToggleToday: (habit: ItemOfType<'habit'>) => void;
  onDelete: (item: Item) => void;
  onRestore?: (item: Item) => void;
  onOpen?: (item: Item) => void;
}

export function ItemList({
  items,
  emptyMessage,
  habitStates,
  onToggleDone,
  onToggleToday,
  onDelete,
  onRestore,
  onOpen,
}: ItemListProps) {
  if (items.length === 0) {
    return <p class="empty">{emptyMessage}</p>;
  }

  return (
    <ul class="item-list">
      {items.map((item) =>
        // Keyed by entity id, never by index: rows get soft-deleted and reordered
        // (CODESTYLE §12).
        item.type === 'habit' ? (
          <HabitRow
            key={item.id}
            habit={item}
            state={habitStates.get(item.id)}
            onToggleToday={onToggleToday}
            onDelete={onDelete}
            {...(onRestore === undefined ? {} : { onRestore })}
          />
        ) : (
          <ItemRow
            key={item.id}
            item={item}
            onToggleDone={onToggleDone}
            onDelete={onDelete}
            {...(onRestore === undefined ? {} : { onRestore })}
            {...(onOpen === undefined || !OPENABLE_TYPES.includes(item.type) ? {} : { onOpen })}
          />
        ),
      )}
    </ul>
  );
}
