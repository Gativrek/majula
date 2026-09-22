import { useCallback, useEffect, useState } from 'react';
import type { Item, ItemOfType, ItemType } from '../data/types.ts';
import { log } from '../lib/logger.ts';
import type { HabitState } from '../services/habits.ts';
import { loadHabitStates, toggleHabitToday } from '../services/habits.ts';
import type { AppContext } from '../services/database.ts';
import { initialiseApp } from '../services/database.ts';
import {
  captureItem,
  deleteItem,
  listDeletedItems,
  listItems,
  loadTagCounts,
  restoreItem,
  searchAll,
  toggleDone,
} from '../services/items.ts';
import { BackupPanel } from './BackupPanel.tsx';
import type { Filter } from './FilterBar.tsx';
import { FilterBar } from './FilterBar.tsx';
import { ItemList } from './ItemList.tsx';
import { QuickCapture } from './QuickCapture.tsx';

type View = 'items' | 'deleted' | 'backup';

const VIEW_LABEL: Record<View, string> = {
  items: 'Items',
  deleted: 'Deleted',
  backup: 'Backup',
};

interface TagCount {
  tag: string;
  count: number;
}

function emptyMessage(view: View, query: string, filter: Filter): string {
  if (view === 'deleted') return 'Nothing deleted.';
  if (query.trim().length > 0) return 'No match.';
  if (filter.tag !== undefined) return `Nothing tagged #${filter.tag}.`;
  if (filter.type !== undefined) return 'Nothing here yet.';
  return 'Nothing captured yet.';
}

export function App() {
  const [context, setContext] = useState<AppContext | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [view, setView] = useState<View>('items');
  const [filter, setFilter] = useState<Filter>({});
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [habitStates, setHabitStates] = useState<ReadonlyMap<string, HabitState>>(new Map());
  const [tags, setTags] = useState<TagCount[]>([]);

  useEffect(function openDatabaseOnce() {
    let cancelled = false;
    async function start(): Promise<void> {
      try {
        const opened = await initialiseApp();
        if (!cancelled) setContext(opened);
      } catch (error) {
        log.error('app.startup_failed', {
          reason: error instanceof Error ? error.name : 'unknown',
        });
        if (!cancelled) {
          setStartupError(
            error instanceof Error ? error.message : 'the database could not be opened',
          );
        }
      }
    }
    void start();
    return function cancel() {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(
    async function refreshVisibleItems(): Promise<void> {
      if (context === null) return;
      if (view === 'deleted') {
        const deleted = await listDeletedItems(context);
        setItems(deleted);
        setHabitStates(await loadHabitStates(context, deleted));
        return;
      }
      const trimmed = query.trim();
      const visible =
        trimmed.length > 0
          ? await searchAll(context, trimmed, filter)
          : await listItems(context, filter);
      setItems(visible);
      setHabitStates(await loadHabitStates(context, visible));
      setTags(await loadTagCounts(context));
    },
    [context, view, query, filter],
  );

  useEffect(
    function loadWheneverTheViewChanges() {
      void refresh();
    },
    [refresh],
  );

  async function onCapture(type: ItemType, title: string, itemTags: string[]): Promise<void> {
    if (context === null) return;
    await captureItem(context, { type, title, tags: itemTags });
    if (view !== 'items') setView('items');
    await refresh();
  }

  async function onToggleDone(item: Item): Promise<void> {
    if (context === null) return;
    await toggleDone(context, item);
    await refresh();
  }

  async function onToggleToday(habit: ItemOfType<'habit'>): Promise<void> {
    if (context === null) return;
    await toggleHabitToday(context, habit.id);
    await refresh();
  }

  async function onDelete(item: Item): Promise<void> {
    if (context === null) return;
    await deleteItem(context, item.id);
    await refresh();
  }

  async function onRestore(item: Item): Promise<void> {
    if (context === null) return;
    await restoreItem(context, item.id);
    await refresh();
  }

  function renderMain() {
    if (startupError !== null) {
      return (
        <p class="banner banner--error">
          Majula could not open its database: {startupError}. It runs on the phone, not in a desktop
          browser.
        </p>
      );
    }
    if (context === null) return <p class="empty">Opening…</p>;
    if (view === 'backup') return <BackupPanel context={context} onDataChanged={refresh} />;

    return (
      <>
        {view === 'items' ? (
          <FilterBar
            query={query}
            filter={filter}
            tags={tags}
            onQueryChange={setQuery}
            onFilterChange={setFilter}
          />
        ) : null}
        <ItemList
          items={items}
          emptyMessage={emptyMessage(view, query, filter)}
          habitStates={habitStates}
          onToggleDone={(item) => void onToggleDone(item)}
          onToggleToday={(habit) => void onToggleToday(habit)}
          onDelete={(item) => void onDelete(item)}
          {...(view === 'deleted' ? { onRestore: (item: Item) => void onRestore(item) } : {})}
        />
      </>
    );
  }

  return (
    <div class="app">
      <header class="app__header">
        <h1 class="app__title">Majula</h1>
        <span class="app__build">{__COMMIT_HASH__}</span>
      </header>

      <main class="app__main">{renderMain()}</main>

      <footer class="app__footer">
        <div class="chips" role="group" aria-label="Section">
          {(Object.keys(VIEW_LABEL) as View[]).map((candidate) => (
            <button
              key={candidate}
              type="button"
              class="chip"
              aria-pressed={view === candidate}
              onClick={() => setView(candidate)}
            >
              {VIEW_LABEL[candidate]}
            </button>
          ))}
        </div>
        <QuickCapture onCapture={onCapture} disabled={context === null} />
      </footer>
    </div>
  );
}
