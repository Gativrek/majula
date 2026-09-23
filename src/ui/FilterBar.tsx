import type { ItemType } from '../data/types.ts';

/**
 * Search, and the type and tag views over the one list (SPECS §2.2).
 *
 * Each module is a chip. There is no per-module screen and no per-module storage: notes,
 * to-do, network log, running-low, habits, recipes, the reading queue and places are all filters over `items`, which is why
 * adding one costs a row in this array and nothing else.
 */

export const TYPE_VIEWS: readonly { type: ItemType; label: string }[] = [
  { type: 'note', label: 'Notes' },
  { type: 'todo', label: 'To-do' },
  { type: 'contact', label: 'Contacts' },
  { type: 'grocery', label: 'Running low' },
  { type: 'habit', label: 'Habits' },
  { type: 'recipe', label: 'Recipes' },
  { type: 'reading', label: 'Reading' },
  { type: 'place', label: 'Places' },
];

export interface Filter {
  type?: ItemType;
  tag?: string;
}

interface FilterBarProps {
  query: string;
  filter: Filter;
  tags: readonly { tag: string; count: number }[];
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: Filter) => void;
}

export function FilterBar({ query, filter, tags, onQueryChange, onFilterChange }: FilterBarProps) {
  const isAll = filter.type === undefined && filter.tag === undefined;

  return (
    <div class="filters">
      <div class="search">
        <input
          class="search__input"
          type="search"
          value={query}
          placeholder="Search"
          aria-label="Search everything"
          autoComplete="off"
          onInput={(event) => onQueryChange((event.currentTarget as HTMLInputElement).value)}
        />
        {query.length > 0 ? (
          <button
            type="button"
            class="icon-button"
            aria-label="Clear search"
            onClick={() => onQueryChange('')}
          >
            {'×'}
          </button>
        ) : null}
      </div>

      <div class="chips chips--scroll" role="group" aria-label="View">
        <button type="button" class="chip" aria-pressed={isAll} onClick={() => onFilterChange({})}>
          All
        </button>
        {TYPE_VIEWS.map((view) => (
          <button
            key={view.type}
            type="button"
            class="chip"
            aria-pressed={filter.type === view.type && filter.tag === undefined}
            onClick={() => onFilterChange({ type: view.type })}
          >
            {view.label}
          </button>
        ))}
        {tags.map((entry) => (
          <button
            key={entry.tag}
            type="button"
            class="chip"
            aria-pressed={filter.tag === entry.tag}
            onClick={() => onFilterChange({ tag: entry.tag })}
          >
            {`#${entry.tag}`}
          </button>
        ))}
      </div>
    </div>
  );
}
