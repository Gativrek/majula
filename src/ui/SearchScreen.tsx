import { useCallback, useEffect, useState } from 'react';
import type { Item } from '../data/types.ts';
import type { AppContext } from '../services/database.ts';
import type { HabitState } from '../services/habits.ts';
import { loadHabitStates, toggleHabitToday } from '../services/habits.ts';
import { deleteItem, loadTagCounts, searchAll, toggleDone } from '../services/items.ts';
import { Icon } from './Icon.tsx';
import { ItemList } from './ItemList.tsx';
import type { OpenScreen } from './OpenScreenView.tsx';
import { screenFor } from './OpenScreenView.tsx';

/**
 * Global search (SPECS §2.2): every type, whatever category the list was showing, and the
 * tags to jump to. Back, or the arrow, returns to the list as it was.
 */

interface SearchScreenProps {
  context: AppContext;
  version: number;
  onClose: () => void;
  onPickTag: (tag: string) => void;
  onOpenScreen: (screen: OpenScreen) => void;
}

interface TagCount {
  tag: string;
  count: number;
}

export function SearchScreen({
  context,
  version,
  onClose,
  onPickTag,
  onOpenScreen,
}: SearchScreenProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [states, setStates] = useState<ReadonlyMap<string, HabitState>>(new Map());
  const [tags, setTags] = useState<TagCount[]>([]);

  const refresh = useCallback(
    async function refreshResults(): Promise<void> {
      const found = await searchAll(context, query);
      setResults(found);
      setStates(await loadHabitStates(context, found));
      setTags(await loadTagCounts(context));
    },
    [context, query, version],
  );

  useEffect(
    function searchAsTheQueryChanges() {
      void refresh();
    },
    [refresh],
  );

  async function after(work: Promise<unknown>): Promise<void> {
    await work;
    await refresh();
  }

  function onOpen(item: Item): void {
    const screen = screenFor(item);
    if (screen !== null) onOpenScreen(screen);
  }

  const searching = query.trim().length > 0;

  return (
    <div class="screen">
      <div class="screen__scroll">
        <header class="top-bar top-bar--search">
          <button type="button" class="icon-button" aria-label="Close search" onClick={onClose}>
            <Icon name="back" />
          </button>
          <label class="search-field">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={query}
              placeholder="Search everything"
              aria-label="Search everything"
              autoComplete="off"
              autoFocus
              onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
            />
            {query.length > 0 ? (
              <button
                type="button"
                class="search-field__clear"
                aria-label="Clear search"
                onClick={() => setQuery('')}
              >
                <Icon name="close" size={18} />
              </button>
            ) : null}
          </label>
        </header>

        {tags.length === 0 ? null : (
          <section class="section">
            <h2 class="kicker">Tags</h2>
            <div class="tag-row">
              {tags.map((entry) => (
                <button
                  key={entry.tag}
                  type="button"
                  class="tag-chip"
                  onClick={() => onPickTag(entry.tag)}
                >
                  {`#${entry.tag}`}
                  <span class="tag-chip__count">{entry.count}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {searching ? (
          <section class="section">
            <div class="section__head">
              <h2 class="kicker">{`${results.length} result${results.length === 1 ? '' : 's'}`}</h2>
              <span class="section__count">Every category</span>
            </div>
            <ItemList
              items={results}
              emptyMessage="No match."
              habitStates={states}
              showType
              onToggleDone={(item) => void after(toggleDone(context, item))}
              onToggleToday={(habit) => void after(toggleHabitToday(context, habit.id))}
              onDelete={(item) => void after(deleteItem(context, item.id))}
              onOpen={onOpen}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
