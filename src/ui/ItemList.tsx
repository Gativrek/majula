import { useState } from 'react';
import type { Item, ItemOfType } from '../data/types.ts';
import type { HabitState } from '../services/habits.ts';
import { HabitRow } from './HabitRow.tsx';
import { Icon } from './Icon.tsx';
import type { RowHighlight } from './ItemRow.tsx';
import { ItemRow } from './ItemRow.tsx';

/**
 * The one list view (ROADMAP Phase 1). Categories and tags are filters over this same
 * list, not screens of their own (SPECS §2.2).
 *
 * Habits get their own row because they carry a streak and a today-toggle instead of a
 * done flag. With `foldDone`, finished rows fold under one "Done" line so the open ones
 * keep the screen.
 */

/** Types that open into a screen of their own when tapped. */
const OPENABLE_TYPES: readonly Item['type'][] = [
  'note',
  'recipe',
  'reading',
  'place',
  'routine',
  'workout_log',
  'exercise',
];

export interface ItemListProps {
  items: readonly Item[];
  emptyMessage: string;
  habitStates: ReadonlyMap<string, HabitState>;
  showType: boolean;
  foldDone?: boolean;
  /** Each row's tags; a row missing from the map has none. */
  tagsByItem?: ReadonlyMap<string, readonly string[]>;
  /** Where a search matched each row. */
  highlights?: ReadonlyMap<string, RowHighlight>;
  onToggleDone: (item: Item) => void;
  onToggleToday: (habit: ItemOfType<'habit'>) => void;
  onDelete: (item: Item) => void;
  onRestore?: (item: Item) => void;
  onOpen?: (item: Item) => void;
}

/** A row's tags and search marks, passed only when it has them. */
function rowExtras(
  props: ItemListProps,
  id: string,
): { tags?: readonly string[]; highlight?: RowHighlight } {
  const tags = props.tagsByItem?.get(id);
  const highlight = props.highlights?.get(id);
  return {
    ...(tags === undefined ? {} : { tags }),
    ...(highlight === undefined ? {} : { highlight }),
  };
}

function Rows(props: ItemListProps & { rows: readonly Item[] }) {
  const { rows, habitStates, onToggleToday, onDelete, onRestore, onOpen } = props;
  return (
    <ul class="list">
      {rows.map((item) =>
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
            showType={props.showType}
            {...rowExtras(props, item.id)}
            onToggleDone={props.onToggleDone}
            onDelete={onDelete}
            {...(onRestore === undefined ? {} : { onRestore })}
            {...(onOpen === undefined || !OPENABLE_TYPES.includes(item.type) ? {} : { onOpen })}
          />
        ),
      )}
    </ul>
  );
}

export function ItemList(props: ItemListProps) {
  const [doneShown, setDoneShown] = useState(false);
  if (props.items.length === 0) return <p class="empty">{props.emptyMessage}</p>;
  if (props.foldDone !== true) return <Rows {...props} rows={props.items} />;

  const open = props.items.filter((item) => !item.done);
  const done = props.items.filter((item) => item.done);
  return (
    <>
      {open.length === 0 ? <p class="empty">All done.</p> : <Rows {...props} rows={open} />}
      {done.length === 0 ? null : (
        <button
          type="button"
          class="fold"
          aria-expanded={doneShown}
          onClick={() => setDoneShown(!doneShown)}
        >
          <span class="fold__mark">
            <Icon name="check" size={14} />
          </span>
          <span class="fold__label">Done</span>
          <span class="fold__count">{done.length}</span>
          <Icon name="chevronDown" size={18} />
        </button>
      )}
      {doneShown && done.length > 0 ? <Rows {...props} rows={done} /> : null}
    </>
  );
}
