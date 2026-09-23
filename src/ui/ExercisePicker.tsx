import { useEffect, useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import type { Outcome } from '../services/workouts.ts';
import { useBackStep } from './use-back-step.ts';

/**
 * Choosing an exercise for a routine (`docs/modules/workout.md` criterion 5): live
 * exercises by name, narrowing as the owner types, and **Create** when nothing matches.
 * Creating from here puts the exercise in the catalog and in the routine in one step.
 *
 * Deleted exercises are never offered: the catalog list reads live rows only.
 */

interface ExercisePickerProps {
  loadExercises: () => Promise<ItemOfType<'exercise'>[]>;
  onCreate: (name: string) => Promise<Outcome<{ exercise: ItemOfType<'exercise'> }>>;
  onChoose: (exercise: ItemOfType<'exercise'>) => void;
  onClose: () => void;
}

function matches(name: string, query: string): boolean {
  return name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

function isExactly(name: string, query: string): boolean {
  return name.trim().localeCompare(query.trim(), undefined, { sensitivity: 'accent' }) === 0;
}

export function ExercisePicker({
  loadExercises,
  onCreate,
  onChoose,
  onClose,
}: ExercisePickerProps) {
  const [exercises, setExercises] = useState<ItemOfType<'exercise'>[] | null>(null);
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  // SPECS §2.2, Back: the picker is one step; back closes it and leaves the routine as it was.
  useBackStep(true, onClose);

  useEffect(
    function loadCatalog() {
      let current = true;
      async function load(): Promise<void> {
        const loaded = await loadExercises();
        if (current) setExercises(loaded);
      }
      void load();
      return function stale() {
        current = false;
      };
    },
    [loadExercises],
  );

  const trimmed = query.trim();
  const shown = (exercises ?? []).filter((exercise) => matches(exercise.title, query));
  const canCreate =
    trimmed.length > 0 && !(exercises ?? []).some((exercise) => isExactly(exercise.title, query));

  async function create(): Promise<void> {
    const result = await onCreate(trimmed);
    if (result.ok) onChoose(result.exercise);
    else setProblem(result.message);
  }

  return (
    <div class="picker" role="dialog" aria-label="Choose an exercise">
      <div class="picker__panel">
        <input
          class="search__input"
          type="search"
          value={query}
          placeholder="Exercise"
          aria-label="Find or name an exercise"
          autoComplete="off"
          onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
        />

        <ul class="picker__list">
          {shown.map((exercise) => (
            <li key={exercise.id}>
              <button type="button" class="picker__option" onClick={() => onChoose(exercise)}>
                {exercise.title}
              </button>
            </li>
          ))}
          {/* Create comes after the matches: a reflex tap on the top row should choose an
              existing exercise, not make a new one out of a half-typed name. */}
          {canCreate ? (
            <li>
              <button
                type="button"
                class="picker__option picker__create"
                onClick={() => void create()}
              >
                {`Create “${trimmed}”`}
              </button>
            </li>
          ) : null}
          {exercises !== null && shown.length === 0 && !canCreate ? (
            <li class="empty">No exercises yet. Type a name to create one.</li>
          ) : null}
        </ul>

        {problem === null ? null : <p class="banner banner--error">{problem}</p>}

        <button type="button" class="button button--quiet" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
