import type { Item } from '../data/types.ts';

/**
 * One row of the list view. Generic over `items`, because most modules are views over
 * one table rather than screens with their own storage (SPECS §2.2).
 */

const TYPE_LABEL: Record<Item['type'], string> = {
  note: 'Note',
  todo: 'To-do',
  reading: 'Reading',
  contact: 'Contact',
  habit: 'Habit',
  grocery: 'Running low',
  recipe: 'Recipe',
  routine: 'Routine',
  workout_log: 'Workout',
  exercise: 'Exercise',
  place: 'Place',
};

/** Types whose `done` flag is meaningful, and so get a toggle (SPECS §2.1). */
const CHECKABLE_TYPES: readonly Item['type'][] = ['todo', 'grocery', 'reading'];

interface ItemRowProps {
  item: Item;
  onToggleDone: (item: Item) => void;
  onDelete: (item: Item) => void;
  onRestore?: (item: Item) => void;
  /** Present for types that open into their own view, such as a recipe in kitchen mode. */
  onOpen?: (item: Item) => void;
}

export function ItemRow({ item, onToggleDone, onDelete, onRestore, onOpen }: ItemRowProps) {
  const isCheckable = CHECKABLE_TYPES.includes(item.type);
  const isDeleted = item.deletedAt !== null;

  return (
    <li class={item.done ? 'item item--done' : 'item'}>
      {isCheckable && !isDeleted ? (
        <button
          type="button"
          class="icon-button"
          aria-pressed={item.done}
          aria-label={item.done ? 'Mark as not done' : 'Mark as done'}
          onClick={() => onToggleDone(item)}
        >
          {item.done ? '✓' : '·'}
        </button>
      ) : null}

      {onOpen === undefined || isDeleted ? (
        <div class="item__content">
          <div class="item__title">{item.title}</div>
          <div class="item__meta">{TYPE_LABEL[item.type]}</div>
        </div>
      ) : (
        <button type="button" class="item__content item__open" onClick={() => onOpen(item)}>
          <div class="item__title">{item.title}</div>
          <div class="item__meta">{TYPE_LABEL[item.type]}</div>
        </button>
      )}

      <div class="item__actions">
        {isDeleted && onRestore !== undefined ? (
          <button
            type="button"
            class="icon-button"
            aria-label="Restore"
            onClick={() => onRestore(item)}
          >
            {'↺'}
          </button>
        ) : (
          <button
            type="button"
            class="icon-button"
            aria-label="Delete"
            onClick={() => onDelete(item)}
          >
            {'×'}
          </button>
        )}
      </div>
    </li>
  );
}
