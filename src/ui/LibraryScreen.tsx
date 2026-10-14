import { useCallback, useEffect, useState } from 'react';
import type { Item } from '../data/types.ts';
import type { AppContext } from '../services/database.ts';
import type { HabitState } from '../services/habits.ts';
import { loadHabitStates } from '../services/habits.ts';
import { listDeletedItems, restoreItem } from '../services/items.ts';
import { BackupPanel } from './BackupPanel.tsx';
import { Icon } from './Icon.tsx';
import { ItemList } from './ItemList.tsx';
import { NoticeBanner } from './NoticeBanner.tsx';
import { PurgeButton } from './PurgeButton.tsx';
import { useListAction } from './use-list-action.ts';

/**
 * Deleted and Backup, one screen reached from the list's header (SPECS §2.2, The list).
 * Back returns to the list.
 */

type Tab = 'deleted' | 'backup';

interface LibraryScreenProps {
  context: AppContext;
  onClose: () => void;
  onDataChanged: () => void;
}

export function LibraryScreen({ context, onClose, onDataChanged }: LibraryScreenProps) {
  const [tab, setTab] = useState<Tab>('deleted');
  const [deleted, setDeleted] = useState<Item[]>([]);
  const [states, setStates] = useState<ReadonlyMap<string, HabitState>>(new Map());

  const refresh = useCallback(
    async function refreshDeleted(): Promise<void> {
      const items = await listDeletedItems(context);
      setDeleted(items);
      setStates(await loadHabitStates(context, items));
    },
    [context],
  );

  const action = useListAction(refresh);

  useEffect(
    function loadDeletedOnOpen() {
      void action.load();
    },
    [action.load],
  );

  async function changed(): Promise<void> {
    await action.load();
    onDataChanged();
  }

  async function onRestore(item: Item): Promise<void> {
    await action.run(restoreItem(context, item.id));
    onDataChanged();
  }

  return (
    <div class="screen">
      <div class="screen__scroll">
        <header class="top-bar">
          <button type="button" class="icon-button" aria-label="Back to the list" onClick={onClose}>
            <Icon name="back" />
          </button>
          <div class="segments" role="tablist" aria-label="Deleted and backup">
            <button
              type="button"
              role="tab"
              class="segments__option"
              aria-selected={tab === 'deleted'}
              onClick={() => setTab('deleted')}
            >
              <Icon name="trash" size={18} />
              Deleted
            </button>
            <button
              type="button"
              role="tab"
              class="segments__option"
              aria-selected={tab === 'backup'}
              onClick={() => setTab('backup')}
            >
              <Icon name="backup" size={18} />
              Backup
            </button>
          </div>
        </header>
        <NoticeBanner notice={action.problem} onDismiss={action.dismiss} />

        {tab === 'deleted' ? (
          <section class="section">
            <div class="section__head">
              <h2 class="kicker">Deleted</h2>
              <span class="section__count">Kept until you purge</span>
            </div>
            <ItemList
              items={deleted}
              emptyMessage="Nothing deleted."
              habitStates={states}
              showType
              onToggleDone={() => undefined}
              onToggleToday={() => undefined}
              onDelete={() => undefined}
              onRestore={(item) => void onRestore(item)}
            />
            {deleted.length === 0 ? null : <PurgeButton context={context} onPurged={changed} />}
          </section>
        ) : (
          <section class="section">
            <BackupPanel context={context} onDataChanged={changed} />
            <p class="build">{`Build ${__COMMIT_HASH__}`}</p>
          </section>
        )}
      </div>
    </div>
  );
}
