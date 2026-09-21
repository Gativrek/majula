import { useCallback, useEffect, useState } from 'react';
import type { Item, ItemType } from '../data/types.ts';
import { log } from '../lib/logger.ts';
import type { AppContext } from '../services/database.ts';
import { initialiseApp } from '../services/database.ts';
import {
  captureItem,
  deleteItem,
  listDeletedItems,
  listItems,
  restoreItem,
  toggleDone,
} from '../services/items.ts';
import { BackupPanel } from './BackupPanel.tsx';
import { ItemList } from './ItemList.tsx';
import { QuickCapture } from './QuickCapture.tsx';

type View = 'items' | 'deleted' | 'backup';

const VIEW_LABEL: Record<View, string> = {
  items: 'Items',
  deleted: 'Deleted',
  backup: 'Backup',
};

const EMPTY_MESSAGE: Record<'items' | 'deleted', string> = {
  items: 'Nothing captured yet.',
  deleted: 'Nothing deleted.',
};

export function App() {
  const [context, setContext] = useState<AppContext | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [view, setView] = useState<View>('items');
  const [items, setItems] = useState<Item[]>([]);

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
      setItems(view === 'deleted' ? await listDeletedItems(context) : await listItems(context));
    },
    [context, view],
  );

  useEffect(
    function loadOnViewChange() {
      void refresh();
    },
    [refresh],
  );

  async function onCapture(type: ItemType, title: string): Promise<void> {
    if (context === null) return;
    await captureItem(context, { type, title });
    if (view !== 'items') setView('items');
    await refresh();
  }

  async function onToggleDone(item: Item): Promise<void> {
    if (context === null) return;
    await toggleDone(context, item);
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

  return (
    <div class="app">
      <header class="app__header">
        <h1 class="app__title">Majula</h1>
        <span class="app__build">{__COMMIT_HASH__}</span>
      </header>

      <main class="app__main">
        {startupError !== null ? (
          <p class="banner banner--error">
            Majula could not open its database: {startupError}. It runs on the phone, not in a
            desktop browser.
          </p>
        ) : context === null ? (
          <p class="empty">Opening…</p>
        ) : view === 'backup' ? (
          <BackupPanel context={context} onDataChanged={refresh} />
        ) : (
          <ItemList
            items={items}
            emptyMessage={EMPTY_MESSAGE[view]}
            onToggleDone={(item) => void onToggleDone(item)}
            onDelete={(item) => void onDelete(item)}
            {...(view === 'deleted' ? { onRestore: (item: Item) => void onRestore(item) } : {})}
          />
        )}
      </main>

      <footer class="app__footer">
        <div class="chips" role="group" aria-label="View">
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
