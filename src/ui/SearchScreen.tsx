import { useCallback, useEffect, useRef, useState } from 'react';
import type { Item } from '../data/types.ts';
import type { AppContext } from '../services/database.ts';
import type { HabitState } from '../services/habits.ts';
import { loadHabitStates, toggleHabitToday } from '../services/habits.ts';
import type { SearchHit } from '../services/items.ts';
import {
  deleteItem,
  loadTagCounts,
  loadTagsFor,
  searchAll,
  toggleDone,
} from '../services/items.ts';
import { Icon } from './Icon.tsx';
import { ItemList } from './ItemList.tsx';
import type { RowHighlight } from './ItemRow.tsx';
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
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [rowTags, setRowTags] = useState<ReadonlyMap<string, readonly string[]>>(new Map());
  const [states, setStates] = useState<ReadonlyMap<string, HabitState>>(new Map());
  const [tags, setTags] = useState<TagCount[]>([]);

  // Typing fires a search per keystroke, and they can finish out of order: only the latest
  // one may fill the screen, or a stale result list replaces a newer one.
  const latest = useRef(0);

  const refresh = useCallback(
    async function refreshResults(): Promise<void> {
      latest.current += 1;
      const ticket = latest.current;
      const found = await searchAll(context, query);
      const items = found.map((hit) => hit.item);
      const habitStates = await loadHabitStates(context, items);
      const tagsOnRows = await loadTagsFor(context, items);
      const tagCounts = await loadTagCounts(context);
      if (ticket !== latest.current) return;
      setHits(found);
      setStates(habitStates);
      setRowTags(tagsOnRows);
      setTags(tagCounts);
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
  const results = hits.map((hit) => hit.item);
  const highlights = new Map<string, RowHighlight>(
    hits.map((hit) => [hit.item.id, { title: hit.markedTitle, snippet: hit.markedSnippet }]),
  );

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
              <h2 class="kicker">{`${hits.length} result${hits.length === 1 ? '' : 's'}`}</h2>
              <span class="section__count">Every category</span>
            </div>
            <ItemList
              items={results}
              tagsByItem={rowTags}
              highlights={highlights}
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
