import { useCallback, useEffect, useState } from 'react';
import type { Item, ItemOfType, ItemType } from '../data/types.ts';
import type { AppContext } from '../services/database.ts';
import type { HabitState } from '../services/habits.ts';
import { loadHabitStates, toggleHabitToday } from '../services/habits.ts';
import { captureItem, deleteItem, listItems, toggleDone } from '../services/items.ts';
import { newRecipeDraft } from '../services/recipe-draft.ts';
import { newRoutineDraft } from '../services/workout-draft.ts';
import { CaptureBar } from './CaptureBar.tsx';
import { CategoryBubble } from './CategoryBubble.tsx';
import type { CategoryId } from './categories.ts';
import { category as categoryOf, isCheckable } from './categories.ts';
import { HabitStrip } from './HabitStrip.tsx';
import { HomeHeader } from './HomeHeader.tsx';
import { Icon } from './Icon.tsx';
import { ItemList } from './ItemList.tsx';
import { NoticeBanner } from './NoticeBanner.tsx';
import type { OpenScreen } from './OpenScreenView.tsx';
import { screenFor } from './OpenScreenView.tsx';

/**
 * The list: habits on top, the category icons, one category's rows, and quick capture at
 * the foot (SPECS §2.2, The list). A tag picked from search replaces the category until it
 * is cleared.
 */

interface HomeScreenProps {
  context: AppContext;
  categoryId: CategoryId;
  tag: string | null;
  /** Bumped by the app whenever data changed elsewhere, so this reloads. */
  version: number;
  notice: string | null;
  onDismissNotice: () => void;
  onCategoryChange: (id: CategoryId) => void;
  onClearTag: () => void;
  onOpenScreen: (screen: OpenScreen) => void;
  onSearch: () => void;
  onLibrary: () => void;
}

export function HomeScreen(props: HomeScreenProps) {
  const { context, categoryId, tag, version } = props;
  const shown = categoryOf(categoryId);
  const [items, setItems] = useState<Item[]>([]);
  const [habits, setHabits] = useState<ItemOfType<'habit'>[]>([]);
  const [states, setStates] = useState<ReadonlyMap<string, HabitState>>(new Map());

  const refresh = useCallback(
    async function refreshList(): Promise<void> {
      const listed = await listItems(context, tag === null ? { types: shown.types } : { tag });
      const allHabits = await listItems(context, { types: ['habit'] });
      setItems(listed);
      setHabits(allHabits.filter((item): item is ItemOfType<'habit'> => item.type === 'habit'));
      setStates(await loadHabitStates(context, [...allHabits, ...listed]));
    },
    [context, shown, tag, version],
  );

  useEffect(
    function loadWheneverTheViewChanges() {
      void refresh();
    },
    [refresh],
  );

  async function onCapture(type: ItemType, title: string, tags: string[]): Promise<void> {
    if (type === 'routine') {
      // workout.md criterion 4: like a recipe, nothing is written until Save.
      const draft = newRoutineDraft(title);
      props.onOpenScreen({ module: 'workout', initial: { kind: 'routine-new', draft, tags } });
      return;
    }
    if (type === 'recipe') {
      // cookbook.md criterion 1: a captured recipe opens straight into the editor, and
      // nothing is written until Save, so backing out of the add leaves no row.
      const draft = newRecipeDraft(title);
      props.onOpenScreen({ module: 'recipe', initial: { mode: 'new', draft, tags } });
      return;
    }
    const captured = await captureItem(context, { type, title, tags });
    // places.md criterion 1: a new place opens with Here one tap away. It is already
    // saved, so this only opens it; back closes it and keeps the place.
    if (captured.type === 'place') props.onOpenScreen({ module: 'place', place: captured });
    await refresh();
  }

  async function after(work: Promise<unknown>): Promise<void> {
    await work;
    await refresh();
  }

  function onOpen(item: Item): void {
    const screen = screenFor(item);
    if (screen !== null) props.onOpenScreen(screen);
  }

  const mixed = tag !== null || shown.types.length > 1;
  const foldDone = tag === null && shown.types.every(isCheckable);
  const openCount = items.filter((item) => !item.done).length;

  return (
    <div class="screen">
      <div class="screen__scroll">
        <HomeHeader onSearch={props.onSearch} onLibrary={props.onLibrary} />
        <NoticeBanner notice={props.notice} onDismiss={props.onDismissNotice} />
        <HabitStrip
          habits={habits}
          states={states}
          onToggleToday={(habit) => void after(toggleHabitToday(context, habit.id))}
          onShowAll={() => props.onCategoryChange('habit')}
        />
        <CategoryBubble
          selected={tag === null ? categoryId : null}
          onSelect={props.onCategoryChange}
        />
        <section class="section">
          <div class="section__head">
            {tag === null ? (
              <h2 class="section__title">{shown.label}</h2>
            ) : (
              <button type="button" class="tag-chip tag-chip--on" onClick={props.onClearTag}>
                {`#${tag}`}
                <Icon name="close" size={14} label="Clear tag" />
              </button>
            )}
            <span class="section__count">
              {foldDone
                ? `${openCount} open`
                : `${items.length} item${items.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <ItemList
            items={items}
            emptyMessage={tag === null ? 'Nothing here yet.' : `Nothing tagged #${tag}.`}
            habitStates={states}
            showType={mixed}
            foldDone={foldDone}
            onToggleDone={(item) => void after(toggleDone(context, item))}
            onToggleToday={(habit) => void after(toggleHabitToday(context, habit.id))}
            onDelete={(item) => void after(deleteItem(context, item.id))}
            onOpen={onOpen}
          />
        </section>
      </div>
      <CaptureBar
        category={shown}
        disabled={false}
        onCapture={onCapture}
        onPickCategory={props.onCategoryChange}
      />
    </div>
  );
}
