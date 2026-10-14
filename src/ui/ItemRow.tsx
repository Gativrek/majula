import type { Item } from '../data/types.ts';
import { isCheckable, typeIcon, typeLabel } from './categories.ts';
import { Icon } from './Icon.tsx';
import { useSwipeReveal } from './use-swipe-reveal.ts';

/**
 * One row of the list. Generic over `items`, because most modules are views over one
 * table rather than screens with their own storage (SPECS §2.2).
 *
 * Inside a category every row is the same type, so the type icon is left off and the
 * checkbox leads. Where types mix — search, a tag, Deleted, Workouts — each row carries
 * its type's icon instead of a word. Delete is a swipe to the left; a deleted row shows
 * Restore instead and does not swipe.
 */

interface ItemRowProps {
  item: Item;
  showType: boolean;
  onToggleDone: (item: Item) => void;
  onDelete: (item: Item) => void;
  onRestore?: (item: Item) => void;
  /** Present for types that open into their own view, such as a recipe in kitchen mode. */
  onOpen?: (item: Item) => void;
}

/** The one line under a title, only where it says something the title does not. */
export function metaFor(item: Item): string | null {
  switch (item.type) {
    case 'routine': {
      const count = item.payload.exercises.length;
      return `${count} exercise${count === 1 ? '' : 's'}`;
    }
    case 'recipe': {
      const count = item.payload.ingredients.length;
      return `${count} ingredient${count === 1 ? '' : 's'} · serves ${item.payload.servings}`;
    }
    case 'place':
      if (item.payload.lat !== undefined) return 'Location saved';
      return item.url === null ? null : 'Maps listing';
    case 'reading':
      if (item.payload.page_count === undefined) return item.url;
      return `PDF · p. ${item.payload.last_page ?? 1} of ${item.payload.page_count}`;
    default:
      return firstLine(item.body);
  }
}

function firstLine(body: string | null): string | null {
  if (body === null) return null;
  const line = body.trim().split('\n', 1)[0] ?? '';
  return line.length === 0 ? null : line;
}

function CheckBox({ item, onToggle }: { item: Item; onToggle: (item: Item) => void }) {
  const label = item.type === 'grocery' ? 'bought' : item.type === 'reading' ? 'read' : 'done';
  return (
    <button
      type="button"
      class="check"
      aria-pressed={item.done}
      aria-label={item.done ? `Mark as not ${label}` : `Mark as ${label}`}
      onClick={() => onToggle(item)}
    >
      <span class="check__box">{item.done ? <Icon name="check" size={16} /> : null}</span>
    </button>
  );
}

export function ItemRow({
  item,
  showType,
  onToggleDone,
  onDelete,
  onRestore,
  onOpen,
}: ItemRowProps) {
  const isDeleted = item.deletedAt !== null;
  const swipe = useSwipeReveal(!isDeleted);
  const checkbox =
    isCheckable(item.type) && !isDeleted ? <CheckBox item={item} onToggle={onToggleDone} /> : null;
  const meta = metaFor(item);
  const text = (
    <>
      <span class="row__title">{item.title}</span>
      {meta === null ? null : <span class="row__meta">{meta}</span>}
    </>
  );

  return (
    <li class={item.done ? 'row row--done' : 'row'}>
      {isDeleted ? null : (
        <button
          type="button"
          class="row__delete"
          aria-label={`Delete ${item.title}`}
          tabIndex={swipe.open ? 0 : -1}
          onClick={() => onDelete(item)}
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
        {showType ? (
          <span class="tile">
            <Icon name={typeIcon(item.type)} label={typeLabel(item.type)} />
          </span>
        ) : (
          checkbox
        )}
        {onOpen === undefined || isDeleted ? (
          <div class="row__text">{text}</div>
        ) : (
          <button type="button" class="row__text row__open" onClick={() => onOpen(item)}>
            {text}
          </button>
        )}
        {showType ? checkbox : null}
        {isDeleted && onRestore !== undefined ? (
          <button
            type="button"
            class="icon-button icon-button--accent"
            aria-label={`Restore ${item.title}`}
            onClick={() => onRestore(item)}
          >
            <Icon name="restore" />
          </button>
        ) : null}
      </div>
    </li>
  );
}
