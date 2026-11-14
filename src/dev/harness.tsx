/**
 * A layout harness for the dev server, and nothing else.
 *
 * `npm run dev` cannot open the database — SQLite is a native plugin (ADR-002) — so the
 * app itself renders only its startup banner in a browser, and that is deliberate
 * (CLAUDE.md). This mounts the prop-driven screens over hand-written fixtures instead,
 * so layout can be looked at without a phone.
 *
 * What this is NOT: a browser fallback. It never calls `initialiseApp`, never touches the
 * boot path, and has no driver of any kind — there are still exactly two `SqlDriver`
 * implementations (SPECS §1.1 item 3). The startup banner stays as loud as it was.
 *
 * It is reachable only at `/harness.html` on the dev server. Vite's default build input is
 * `index.html` alone, so `harness.html` is never bundled and cannot reach the APK. Do not
 * add it to `build.rollupOptions.input`.
 *
 * The list scene keeps its rows in memory so taps do something. It drives the app's own
 * motion — `motion.css`, `motion.ts`, and the tap marks the components set themselves — so
 * what moves here is what ships (SPECS §2.2, Look and motion). With reduced motion on in
 * the operating system, it shows the app without motion, as the phone would.
 *
 * Acceptance is still the device (SPECS §6). Anything seen here is a layout lead, not a
 * passed check.
 */

import type { JSX } from 'preact';
import { render } from 'preact';
import { useState } from 'react';
import type { Item, ItemOfType, ItemType } from '../data/types.ts';
import type { HabitState } from '../services/habits.ts';
import { draftFromRecipe } from '../services/recipe-draft.ts';
import { CaptureBar } from '../ui/CaptureBar.tsx';
import { CategoryBubble } from '../ui/CategoryBubble.tsx';
import type { CategoryId } from '../ui/categories.ts';
import { category as categoryOf, isCheckable } from '../ui/categories.ts';
import { ExerciseDetail } from '../ui/ExerciseDetail.tsx';
import { HabitStrip } from '../ui/HabitStrip.tsx';
import { HomeHeader } from '../ui/HomeHeader.tsx';
import { ItemList } from '../ui/ItemList.tsx';
import { TICK_MS, motionAllowed, slideKind, withViewTransition } from '../ui/motion.ts';
import { PlaceDetail } from '../ui/PlaceDetail.tsx';
import { ReadingDetail } from '../ui/ReadingDetail.tsx';
import { RecipeEditor } from '../ui/RecipeEditor.tsx';
import { RecipeView } from '../ui/RecipeView.tsx';
import { RoutineView } from '../ui/RoutineView.tsx';
import { WorkoutLogView } from '../ui/WorkoutLogView.tsx';
import * as fixture from './fixtures.ts';
import '../ui/theme.css';
import '../ui/motion.css';
import './harness.css';

function noop(): void {}
async function asyncNoop(): Promise<void> {}

/**
 * A state change here is synchronous where the app's is a database write and a reload; the
 * view transition and its timing are the app's own.
 */
function transition(kind: string, update: () => void): void {
  void withViewTransition(kind, async function apply() {
    update();
  });
}

const PLAIN_CAPTURE: readonly ItemType[] = ['todo', 'note', 'grocery', 'contact'];

function isPlainCapture(type: ItemType): type is 'todo' | 'note' | 'grocery' | 'contact' {
  return PLAIN_CAPTURE.includes(type);
}

/**
 * The list, built exactly as `HomeScreen` builds it — `.screen` around a `.screen__scroll`
 * with the capture bar outside it. Mirroring that wrapper matters: without it the capture
 * bar stops sitting at the foot, and the harness invents a bug the app does not have.
 */
function ListScene() {
  const [items, setItems] = useState<Item[]>(fixture.allItems);
  const [states, setStates] = useState<ReadonlyMap<string, HabitState>>(fixture.habitStates);
  const [categoryId, setCategoryId] = useState<CategoryId>('todo');
  const [nextId, setNextId] = useState(1);
  const shown = categoryOf(categoryId);
  const rows = items.filter(function inCategory(item) {
    return shown.types.includes(item.type);
  });
  const foldDone = shown.types.every(isCheckable);
  const openCount = rows.filter((item) => !item.done).length;

  function chooseCategory(id: CategoryId): void {
    if (id === categoryId) return;
    transition(slideKind(categoryId, id), () => setCategoryId(id));
  }

  function toggleDone(item: Item): void {
    function flip(): void {
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, done: !row.done } : row)),
      );
    }
    // Checking off shows the tick first, then folds the row away; unchecking is immediate.
    if (!item.done && motionAllowed()) {
      setTimeout(() => transition('check', flip), TICK_MS);
    } else {
      transition('check', flip);
    }
  }

  function remove(ids: ReadonlySet<string>): void {
    transition('delete', () => setItems((current) => current.filter((row) => !ids.has(row.id))));
  }

  function toggleToday(habit: ItemOfType<'habit'>): void {
    setStates(function next(current) {
      const was = current.get(habit.id) ?? { checkedToday: false, streak: 0 };
      const now = {
        checkedToday: !was.checkedToday,
        streak: was.streak + (was.checkedToday ? -1 : 1),
      };
      return new Map(current).set(habit.id, now);
    });
  }

  async function capture(type: ItemType, text: string): Promise<boolean> {
    if (!isPlainCapture(type)) return true;
    const row = fixture.captured(`new-${nextId}`, type, text);
    setNextId(nextId + 1);
    transition('add', () => setItems((current) => [row, ...current]));
    return true;
  }

  return (
    <div class="app" data-cat={categoryId}>
      <div class="screen">
        <div class="screen__scroll">
          <HomeHeader onSearch={noop} onLibrary={noop} />
          <HabitStrip
            habits={fixture.habits}
            states={states}
            onToggleToday={toggleToday}
            onShowAll={noop}
          />
          <CategoryBubble selected={categoryId} onSelect={chooseCategory} />
          <section class="section section--list">
            <div class="section__head">
              <h2 class="section__title">{shown.label}</h2>
              <span class="section__count">
                {foldDone
                  ? `${openCount} open`
                  : `${rows.length} item${rows.length === 1 ? '' : 's'}`}
              </span>
            </div>
            <ItemList
              items={rows}
              emptyMessage="Nothing here yet."
              habitStates={states}
              showType={shown.types.length > 1}
              foldDone={foldDone}
              tagsByItem={fixture.tagsByItem}
              onToggleDone={toggleDone}
              onToggleToday={toggleToday}
              onDelete={(item) => remove(new Set([item.id]))}
              onDeleteDone={(done) => remove(new Set(done.map((row) => row.id)))}
              onOpen={noop}
            />
            {rows.length === 0 ? null : (
              <p class="list-hint">Hold a row to delete it. Swipe sideways for the next list.</p>
            )}
          </section>
        </div>
        <CaptureBar
          category={shown}
          disabled={false}
          knownTags={fixture.knownTags}
          onCapture={capture}
          onPickCategory={chooseCategory}
        />
      </div>
    </div>
  );
}

interface Scene {
  id: string;
  label: string;
  render: () => JSX.Element;
}

const SCENES: Scene[] = [
  { id: 'list', label: 'List', render: () => <ListScene /> },
  {
    id: 'recipe',
    label: 'Recipe',
    render: () => (
      <div class="app app--open" data-cat="recipe">
        <RecipeView recipe={fixture.recipe} onClose={noop} onEdit={noop} />
      </div>
    ),
  },
  {
    id: 'recipe-edit',
    label: 'Recipe · edit',
    render: () => (
      <div class="app app--open" data-cat="recipe">
        <RecipeEditor
          initial={draftFromRecipe(fixture.recipe.title, fixture.recipe.payload)}
          onSave={async function save() {
            return { ok: true } as const;
          }}
          onCancel={noop}
        />
      </div>
    ),
  },
  {
    id: 'reading',
    label: 'Reading',
    render: () => (
      <div class="app app--open" data-cat="reading">
        <ReadingDetail
          reading={fixture.reading}
          onSaveDetails={async function saveDetails() {
            return { ok: true } as const;
          }}
          onAttach={async function attach() {
            return { ok: true, reading: fixture.reading } as const;
          }}
          onToggleRead={asyncNoop}
          onRemovePdf={asyncNoop}
          onOpenPdf={noop}
          onClose={noop}
        />
      </div>
    ),
  },
  {
    id: 'place',
    label: 'Place',
    render: () => (
      <div class="app app--open" data-cat="place">
        <PlaceDetail
          place={fixture.place}
          onSaveDetails={async function saveDetails() {
            return { ok: true } as const;
          }}
          onLocate={async function locate() {
            return { ok: true, lat: 38.7369, lon: -9.1427, accuracyMetres: 12 } as const;
          }}
          onSetCoordinates={asyncNoop}
          onSetLink={asyncNoop}
          onClearCoordinates={asyncNoop}
          onClose={noop}
        />
      </div>
    ),
  },
  {
    id: 'routine',
    label: 'Routine',
    render: () => (
      <div class="app app--open" data-cat="workouts">
        <RoutineView
          routine={fixture.routine}
          nameOf={fixture.nameOf}
          onStart={noop}
          onEdit={noop}
          onClose={noop}
        />
      </div>
    ),
  },
  {
    id: 'log',
    label: 'Workout log',
    render: () => (
      <div class="app app--open" data-cat="workouts">
        <WorkoutLogView log={fixture.workoutLog} nameOf={fixture.nameOf} onClose={noop} />
      </div>
    ),
  },
  {
    id: 'exercise',
    label: 'Exercise',
    render: () => (
      <div class="app app--open" data-cat="workouts">
        <ExerciseDetail
          exercise={fixture.exercise}
          loadHistory={async function history() {
            return [
              {
                logId: 'w1',
                performedAt: fixture.workoutLog.createdAt,
                sets: [
                  { reps: 10, load_kg: 60 },
                  { reps: 8, load_kg: 62.5 },
                ],
              },
            ];
          }}
          onSave={async function save() {
            return { ok: true } as const;
          }}
          onClose={noop}
        />
      </div>
    ),
  },
];

const FIRST = SCENES[0] as Scene;

function Harness() {
  const [sceneId, setSceneId] = useState(FIRST.id);
  const shown =
    SCENES.find(function match(candidate) {
      return candidate.id === sceneId;
    }) ?? FIRST;

  return (
    <>
      {/* Keyed, so switching scene mounts the new screen and its entrance plays. */}
      <div class="harness-stage" key={shown.id}>
        {shown.render()}
      </div>
      <nav class="harness-bar">
        {SCENES.map(function tab(candidate) {
          return (
            <button
              key={candidate.id}
              type="button"
              class={candidate.id === sceneId ? 'is-current' : ''}
              onClick={() => setSceneId(candidate.id)}
            >
              {candidate.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}

const root = document.getElementById('app');
if (root === null) throw new Error('harness.html is missing its #app element');
render(<Harness />, root);
