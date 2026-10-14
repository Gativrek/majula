import { useCallback, useEffect, useState } from 'react';
import { log } from '../lib/logger.ts';
import type { AppContext } from '../services/database.ts';
import { initialiseApp } from '../services/database.ts';
import type { CategoryId } from './categories.ts';
import { DEFAULT_CATEGORY } from './categories.ts';
import { HomeScreen } from './HomeScreen.tsx';
import { LibraryScreen } from './LibraryScreen.tsx';
import type { OpenScreen } from './OpenScreenView.tsx';
import { OpenScreenView } from './OpenScreenView.tsx';
import { SearchScreen } from './SearchScreen.tsx';
import type { StartupFailure } from './StartupBanner.tsx';
import { StartupBanner, startupFailureFrom } from './StartupBanner.tsx';
import { useBackStep } from './use-back-step.ts';
import { useShareReceiver } from './use-share-receiver.ts';

/**
 * Opens the database, then shows one of: the list, search, Deleted and Backup, or an open
 * module screen. Each of those owns its own data; this holds only which one is showing and
 * what the list was filtered to, so that coming back finds it as it was.
 */

type Screen = 'home' | 'search' | 'library';

export function App() {
  const [context, setContext] = useState<AppContext | null>(null);
  const [startupFailure, setStartupFailure] = useState<StartupFailure | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [categoryId, setCategoryId] = useState<CategoryId>(DEFAULT_CATEGORY);
  const [tag, setTag] = useState<string | null>(null);
  const [open, setOpen] = useState<OpenScreen | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped whenever data changes outside the screen showing, so it reloads.
  const [version, setVersion] = useState(0);

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
        if (!cancelled) setStartupFailure(startupFailureFrom(error));
      }
    }
    void start();
    return function cancel() {
      cancelled = true;
    };
  }, []);

  const dataChanged = useCallback(async function bumpVersion(): Promise<void> {
    setVersion((current) => current + 1);
  }, []);

  // places.md 15–17: a Google Maps share opens as a place; anything else is refused.
  useShareReceiver(context, {
    onPlace(place) {
      setNotice(null);
      setOpen({ module: 'place', place });
      void dataChanged();
    },
    onProblem: setNotice,
  });

  /*
   * SPECS §2.2, Back. Search and Deleted/Backup return to the list, and a tag view returns
   * to its category; each open module registers its own steps above these. On the list
   * itself no step is active and back leaves the app.
   */
  useBackStep(screen !== 'home', function backToList() {
    setScreen('home');
  });
  useBackStep(screen === 'home' && tag !== null, function clearTag() {
    setTag(null);
  });

  const closeOpen = useCallback(function closeOpenScreen() {
    setOpen(null);
  }, []);

  function chooseCategory(id: CategoryId): void {
    setTag(null);
    setCategoryId(id);
  }

  function pickTag(picked: string): void {
    setTag(picked);
    setScreen('home');
  }

  if (startupFailure !== null) {
    return (
      <div class="app app--message">
        <StartupBanner failure={startupFailure} />
      </div>
    );
  }
  if (context === null) {
    return (
      <div class="app app--message">
        <p class="empty">Opening…</p>
      </div>
    );
  }

  if (open !== null) {
    return (
      <div class="app">
        <OpenScreenView
          screen={open}
          context={context}
          onClose={closeOpen}
          onChanged={dataChanged}
        />
      </div>
    );
  }

  return (
    <div class="app">
      {screen === 'search' ? (
        <SearchScreen
          context={context}
          version={version}
          onClose={() => setScreen('home')}
          onPickTag={pickTag}
          onOpenScreen={setOpen}
        />
      ) : screen === 'library' ? (
        <LibraryScreen
          context={context}
          onClose={() => setScreen('home')}
          onDataChanged={dataChanged}
        />
      ) : (
        <HomeScreen
          context={context}
          categoryId={categoryId}
          tag={tag}
          version={version}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
          onCategoryChange={chooseCategory}
          onClearTag={() => setTag(null)}
          onOpenScreen={setOpen}
          onSearch={() => setScreen('search')}
          onLibrary={() => setScreen('library')}
        />
      )}
    </div>
  );
}
