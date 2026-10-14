import { useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import type { RoutineDraft, RoutineEntryDraft } from '../services/workout-draft.ts';
import { NEW_ENTRY_DEFAULTS } from '../services/workout-draft.ts';
import type { Outcome, ResolvedName } from '../services/workouts.ts';
import { ExercisePicker } from './ExercisePicker.tsx';
import { Icon } from './Icon.tsx';
import { ModuleHeader } from './ModuleHeader.tsx';

/**
 * Editing a routine (`docs/modules/workout.md` criteria 4–7): its name, and each
 * exercise's sets, reps and load. Exercises come from the picker, never typed as names.
 */

/** Entries are removed mid-list, so each keeps a key that survives it (CODESTYLE §12). */
interface Row {
  key: number;
  entry: RoutineEntryDraft;
}

let nextKey = 0;
function row(entry: RoutineEntryDraft): Row {
  nextKey += 1;
  return { key: nextKey, entry };
}

interface RoutineEditorProps {
  initial: RoutineDraft;
  nameOf: (exerciseId: string) => ResolvedName;
  loadExercises: () => Promise<ItemOfType<'exercise'>[]>;
  onCreateExercise: (name: string) => Promise<Outcome<{ exercise: ItemOfType<'exercise'> }>>;
  onSave: (draft: RoutineDraft) => Promise<Outcome<object>>;
  onCancel: () => void;
}

function value(event: Event): string {
  return (event.currentTarget as HTMLInputElement).value;
}

export function RoutineEditor({
  initial,
  nameOf,
  loadExercises,
  onCreateExercise,
  onSave,
  onCancel,
}: RoutineEditorProps) {
  const [title, setTitle] = useState(initial.title);
  const [rows, setRows] = useState<Row[]>(() => initial.entries.map(row));
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Exercises created in the picker are not in the caller's name map yet.
  const [chosenNames, setChosenNames] = useState<Map<string, string>>(new Map());

  function nameFor(exerciseId: string): { name: string; isDeleted: boolean } {
    const chosen = chosenNames.get(exerciseId);
    if (chosen !== undefined) return { name: chosen, isDeleted: false };
    return nameOf(exerciseId);
  }

  function update(key: number, field: 'sets' | 'reps' | 'load', text: string): void {
    setRows((current) =>
      current.map((r) => (r.key === key ? { key, entry: { ...r.entry, [field]: text } } : r)),
    );
  }

  function choose(exercise: ItemOfType<'exercise'>): void {
    setChosenNames((names) => new Map(names).set(exercise.id, exercise.title));
    setRows((current) => [...current, row({ exerciseId: exercise.id, ...NEW_ENTRY_DEFAULTS })]);
    setPicking(false);
  }

  async function save(): Promise<void> {
    setSaving(true);
    setProblem(null);
    try {
      const result = await onSave({ title, entries: rows.map((r) => r.entry) });
      if (!result.ok) setProblem(result.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="kitchen kitchen--editing">
      <ModuleHeader
        icon="routine"
        label="Routine"
        onBack={onCancel}
        backLabel="Cancel"
        backIcon="close"
      />

      <main class="kitchen__body editor">
        <label class="editor__field">
          <span class="editor__label">Name</span>
          <input
            class="capture__input"
            type="text"
            value={title}
            onInput={(e) => setTitle(value(e))}
          />
        </label>

        <section class="kitchen__section">
          <h3 class="kitchen__heading">Exercises</h3>
          {rows.map((r) => {
            const { name, isDeleted } = nameFor(r.entry.exerciseId);
            return (
              <div key={r.key} class="card routine__entry">
                <div class="card__row">
                  <span class="row__text">
                    <span class="row__title">{name}</span>
                    {isDeleted ? <span class="row__meta">Deleted from the catalog</span> : null}
                  </span>
                  <button
                    type="button"
                    class="icon-button"
                    aria-label={`Remove ${name}`}
                    onClick={() => setRows((current) => current.filter((x) => x.key !== r.key))}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </div>
                <div class="routine__numbers">
                  <label class="routine__number">
                    <span>Sets</span>
                    <input
                      class="set-grid__input"
                      type="text"
                      inputMode="numeric"
                      value={r.entry.sets}
                      onInput={(e) => update(r.key, 'sets', value(e))}
                    />
                  </label>
                  <label class="routine__number">
                    <span>Reps</span>
                    <input
                      class="set-grid__input"
                      type="text"
                      inputMode="numeric"
                      value={r.entry.reps}
                      onInput={(e) => update(r.key, 'reps', value(e))}
                    />
                  </label>
                  <label class="routine__number">
                    <span>kg</span>
                    <input
                      class="set-grid__input"
                      type="text"
                      inputMode="decimal"
                      value={r.entry.load}
                      onInput={(e) => update(r.key, 'load', value(e))}
                    />
                  </label>
                </div>
              </div>
            );
          })}
          <button type="button" class="dashed-button" onClick={() => setPicking(true)}>
            <Icon name="plus" size={18} />
            Add exercise
          </button>
        </section>

        {problem === null ? null : <p class="banner banner--error">{problem}</p>}
      </main>

      <footer class="kitchen__actions">
        <button type="button" class="button" disabled={saving} onClick={() => void save()}>
          <Icon name="check" size={20} />
          Save routine
        </button>
      </footer>

      {picking ? (
        <ExercisePicker
          loadExercises={loadExercises}
          onCreate={onCreateExercise}
          onChoose={choose}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}
