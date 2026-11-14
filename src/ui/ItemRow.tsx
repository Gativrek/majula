import type { Item } from '../data/types.ts';
import { isCheckable, typeIcon, typeLabel } from './categories.ts';
import { Icon } from './Icon.tsx';
import { Marked } from './Marked.tsx';
import { useHoldReveal } from './use-hold-reveal.ts';
import { tappedAttribute, useTapMark } from './use-tap-mark.ts';

/**
 * One row of the list. Generic over `items`, because most modules are views over one
 * table rather than screens with their own storage (SPECS §2.2).
 *
 * Inside a category every row is the same type, so the type icon is left off and the
 * checkbox leads. Where types mix — search, a tag, Deleted, Workouts — each row carries
 * its type's icon instead of a word. Holding a row uncovers Delete; a deleted row shows
 * Restore instead and does not open.
 *
 * A row shows its tags beside the title. A search result marks the words that matched, and
 * shows the stretch of body around a match in place of its usual second line.
 */

/** Where a search matched this row (SPECS §2.2, Global search). */
export interface RowHighlight {
  title: string;
  snippet: string | null;
}

interface ItemRowProps {
  item: Item;
  showType: boolean;
  tags?: readonly string[];
  highlight?: RowHighlight;
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

/** At most two tags on a row, then a count: the title keeps the space. */
export function tagLine(tags: readonly string[]): string {
  const shown = tags.slice(0, 2).map((tag) => `#${tag}`);
  const more = tags.length - shown.length;
  return more > 0 ? `${shown.join(' ')} +${more}` : shown.join(' ');
}

function firstLine(body: string | null): string | null {
  if (body === null) return null;
  const line = body.trim().split('\n', 1)[0] ?? '';
  return line.length === 0 ? null : line;
}

/**
 * A row's view-transition name, by its item's id, so a row that moves is animated as
 * itself — into the Done list as it is checked, say (motion.css). Read through a custom
 * property so the stylesheet can still switch names off during a category change.
 */
export function transitionName(id: string): string {
  return `--vt-name: row-${id}`;
}

/** Marks itself on a tap, so motion.css can land the tick before the row folds away. */
function CheckBox({ item, onToggle }: { item: Item; onToggle: (item: Item) => void }) {
  const label = item.type === 'grocery' ? 'bought' : item.type === 'reading' ? 'read' : 'done';
  const tap = useTapMark();
  return (
    <button
      type="button"
      class="check"
      aria-pressed={item.done}
      aria-label={item.done ? `Mark as not ${label}` : `Mark as ${label}`}
      data-tapped={tappedAttribute(tap.marked('check'))}
      onClick={() => {
        tap.mark('check');
        onToggle(item);
      }}
    >
      <span class="check__box">{item.done ? <Icon name="check" size={16} /> : null}</span>
    </button>
  );
}

export function ItemRow({
  item,
  showType,
  tags,
  highlight,
  onToggleDone,
  onDelete,
  onRestore,
  onOpen,
}: ItemRowProps) {
  const isDeleted = item.deletedAt !== null;
  const reveal = useHoldReveal(!isDeleted);
  const checkbox =
    isCheckable(item.type) && !isDeleted ? <CheckBox item={item} onToggle={onToggleDone} /> : null;
  const meta = metaFor(item);
  const snippet = highlight?.snippet ?? null;
  const text = (
    <>
      <span class="row__title">
        {highlight === undefined ? item.title : <Marked text={highlight.title} />}
      </span>
      {snippet !== null ? (
        <span class="row__meta">
          <Marked text={snippet} />
        </span>
      ) : meta === null ? null : (
        <span class="row__meta">{meta}</span>
      )}
    </>
  );
  const tagText = tags === undefined || tags.length === 0 ? null : tagLine(tags);

  return (
    <li class={item.done ? 'row row--done' : 'row'} style={transitionName(item.id)}>
      {isDeleted ? null : (
        <button
          type="button"
          class="row__delete"
          aria-label={`Delete ${item.title}`}
          tabIndex={reveal.open ? 0 : -1}
          onClick={() => onDelete(item)}
        >
          <Icon name="trash" size={20} />
          Delete
        </button>
      )}
      <div
        class="row__face"
        style={{ transform: `translateX(${reveal.offset}px)` }}
        {...reveal.handlers}
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
        {tagText === null ? null : <span class="row__tags">{tagText}</span>}
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
