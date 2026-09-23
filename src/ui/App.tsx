import { useCallback, useEffect, useState } from 'react';
import type { Item, ItemOfType, ItemType } from '../data/types.ts';
import { log } from '../lib/logger.ts';
import type { HabitState } from '../services/habits.ts';
import { loadHabitStates, toggleHabitToday } from '../services/habits.ts';
import type { AppContext } from '../services/database.ts';
import { initialiseApp, StartupError } from '../services/database.ts';
import type { RecipeDraft } from '../services/recipe-draft.ts';
import { draftFromRecipe, newRecipeDraft } from '../services/recipe-draft.ts';
import { addRecipe, getRecipe, saveRecipe } from '../services/recipes.ts';
import {
  attachPdf,
  openReadingPdf,
  saveLastPage,
  saveReadingDetails,
} from '../services/reading.ts';
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
import { RecipeEditor } from './RecipeEditor.tsx';
import { PdfViewer } from './PdfViewer.tsx';
import { ReadingDetail } from './ReadingDetail.tsx';
import { RecipeView } from './RecipeView.tsx';
import { useBackStep } from './use-back-step.ts';
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

/**
 * A recipe open full-screen: read in kitchen mode, being edited, or being added. A new
 * recipe is only a draft — it has no row until Save (SPECS §2.2, Back).
 */
type OpenRecipe =
  | { mode: 'view'; recipe: ItemOfType<'recipe'> }
  | { mode: 'edit'; recipe: ItemOfType<'recipe'> }
  | { mode: 'new'; draft: RecipeDraft; tags: string[] };

/** A reading entry open full-screen: its detail, or its PDF in the viewer. */
interface OpenReading {
  mode: 'detail' | 'pdf';
  reading: ItemOfType<'reading'>;
}

interface StartupFailure {
  stage: 'open' | 'migrate' | 'files' | 'unknown';
  detail: string;
}

/**
 * What to tell the owner. Each stage has a different cause and a different next step, so
 * the screen says which one it was rather than guessing at the most likely.
 */
function startupAdvice(failure: StartupFailure): string {
  switch (failure.stage) {
    case 'open':
      return 'SQLite is a native plugin, so this happens in a desktop browser. On the phone it means the database could not be opened at all.';
    case 'migrate':
      return 'The database opened but its schema could not be brought up to date. The data is untouched; the logs carry the failing migration under migration.start.';
    case 'files':
      return 'The database is fine, but app storage could not be reached, so export and import will not work.';
    default:
      return 'Startup failed before the app could tell what went wrong.';
  }
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
  const [startupFailure, setStartupFailure] = useState<StartupFailure | null>(null);
  const [view, setView] = useState<View>('items');
  const [filter, setFilter] = useState<Filter>({});
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [habitStates, setHabitStates] = useState<ReadonlyMap<string, HabitState>>(new Map());
  const [tags, setTags] = useState<TagCount[]>([]);
  const [openRecipe, setOpenRecipe] = useState<OpenRecipe | null>(null);
  const [openReading, setOpenReading] = useState<OpenReading | null>(null);

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
          setStartupFailure({
            stage: error instanceof StartupError ? error.stage : 'unknown',
            detail: error instanceof Error ? error.message : 'an unknown failure',
          });
        }
      }
    }
    void start();
    return function cancel() {
      cancelled = true;
    };
  }, []);

  // The viewer opens its document in an effect keyed on this function, so it changes only
  // when a different entry is opened — not when a page turn re-reads the same one.
  const openReadingId = openReading?.reading.id;
  const openPdf = useCallback(
    async function openCurrentPdf() {
      if (context === null || openReadingId === undefined) return { status: 'none' as const };
      return openReadingPdf(context, openReadingId);
    },
    [context, openReadingId],
  );

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
    if (type === 'recipe') {
      // cookbook.md criterion 1: a captured recipe opens straight into the editor, and
      // nothing is written until Save, so backing out of the add leaves no row.
      setOpenRecipe({ mode: 'new', draft: newRecipeDraft(title), tags: itemTags });
      return;
    }
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

  function onOpen(item: Item): void {
    if (item.type === 'recipe') setOpenRecipe({ mode: 'view', recipe: item });
    if (item.type === 'reading') setOpenReading({ mode: 'detail', reading: item });
  }

  async function onSaveRecipe(id: string, draft: RecipeDraft) {
    if (context === null) return { ok: false as const, field: 'app', message: 'Not ready.' };
    const result = await saveRecipe(context, id, draft);
    if (result.ok) {
      const saved = await getRecipe(context, id);
      setOpenRecipe(saved === null ? null : { mode: 'view', recipe: saved });
      await refresh();
    }
    return result;
  }

  async function onAddRecipe(draft: RecipeDraft, recipeTags: readonly string[]) {
    if (context === null) return { ok: false as const, field: 'app', message: 'Not ready.' };
    const result = await addRecipe(context, draft, recipeTags);
    if (result.ok) {
      setOpenRecipe({ mode: 'view', recipe: result.recipe });
      await refresh();
    }
    return result;
  }

  /*
   * SPECS §2.2, Back. Each layer below is one step the back button undoes, newest first:
   * an edit to an existing recipe returns to it unchanged; an open or new recipe closes,
   * and a new one closes having written nothing; Deleted and Backup return to the list.
   * On the list itself no step is active, so back leaves the app.
   */
  useBackStep(view !== 'items', function backToList() {
    setView('items');
  });
  useBackStep(openRecipe !== null, function closeRecipe() {
    setOpenRecipe(null);
  });
  useBackStep(openReading !== null, function closeReading() {
    setOpenReading(null);
  });
  useBackStep(openReading?.mode === 'pdf', function closeViewer() {
    setOpenReading((current) =>
      current?.mode === 'pdf' ? { mode: 'detail', reading: current.reading } : current,
    );
  });
  useBackStep(openRecipe?.mode === 'edit', function cancelEdit() {
    setOpenRecipe((current) =>
      current?.mode === 'edit' ? { mode: 'view', recipe: current.recipe } : current,
    );
  });

  async function onRestore(item: Item): Promise<void> {
    if (context === null) return;
    await restoreItem(context, item.id);
    await refresh();
  }

  function renderRecipe(open: OpenRecipe) {
    if (open.mode === 'new') {
      return (
        <RecipeEditor
          initial={open.draft}
          onSave={(draft) => onAddRecipe(draft, open.tags)}
          onCancel={() => setOpenRecipe(null)}
        />
      );
    }
    const { recipe } = open;
    if (open.mode === 'edit') {
      return (
        <RecipeEditor
          initial={draftFromRecipe(recipe.title, recipe.payload)}
          onSave={(draft) => onSaveRecipe(recipe.id, draft)}
          onCancel={() => setOpenRecipe({ mode: 'view', recipe })}
        />
      );
    }
    return (
      <RecipeView
        recipe={recipe}
        onClose={() => setOpenRecipe(null)}
        onEdit={() => setOpenRecipe({ mode: 'edit', recipe })}
      />
    );
  }

  /** Re-read an entry after a change so the detail screen shows what was stored. */
  async function reloadReading(id: string): Promise<void> {
    if (context === null) return;
    const fresh = await context.items.get(id);
    setOpenReading((current) =>
      current !== null && fresh?.type === 'reading' ? { ...current, reading: fresh } : current,
    );
    await refresh();
  }

  function renderReading(open: OpenReading, ready: AppContext) {
    const { reading } = open;
    if (open.mode === 'pdf') {
      return (
        <PdfViewer
          title={reading.title}
          open={openPdf}
          onPageChange={(page) => void saveLastPage(ready, reading.id, page)}
          onClose={() => void reloadReading(reading.id)}
        />
      );
    }
    return (
      <ReadingDetail
        key={reading.id}
        reading={reading}
        onSaveDetails={async (details) => {
          const result = await saveReadingDetails(ready, reading.id, details);
          if (result.ok) await reloadReading(reading.id);
          return result;
        }}
        onAttach={async (bytes) => {
          const result = await attachPdf(ready, reading.id, bytes);
          if (result.ok) await reloadReading(reading.id);
          return result;
        }}
        onOpenPdf={() => setOpenReading({ mode: 'pdf', reading })}
        onClose={() => setOpenReading(null)}
      />
    );
  }

  function renderMain() {
    if (startupFailure !== null) {
      return (
        <p class="banner banner--error">
          Majula could not start ({startupFailure.stage}): {startupFailure.detail}.{' '}
          {startupAdvice(startupFailure)}
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
          onOpen={onOpen}
          {...(view === 'deleted' ? { onRestore: (item: Item) => void onRestore(item) } : {})}
        />
      </>
    );
  }

  if (openRecipe !== null) {
    return <div class="app">{renderRecipe(openRecipe)}</div>;
  }
  if (openReading !== null && context !== null) {
    return <div class="app">{renderReading(openReading, context)}</div>;
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
