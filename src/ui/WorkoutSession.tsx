import { useState } from 'react';
import type { SessionDraft, SetDraft } from '../services/workout-draft.ts';
import type { Outcome, ResolvedName } from '../services/workouts.ts';
import type { SetRow } from './ExerciseCard.tsx';
import { ExerciseCard } from './ExerciseCard.tsx';
import { Icon } from './Icon.tsx';

/**
 * A workout in progress (`docs/modules/workout.md` criteria 9–10): every exercise of the
 * routine with its sets pre-filled, each changeable, addable and removable. **Save**
 * writes one log; the header’s × or back writes nothing (SPECS §2.2, Back).
 */

interface EntryRow {
  exerciseId: string;
  sets: SetRow[];
}

let nextKey = 0;
function setRow(set: SetDraft, planned: SetDraft | null): SetRow {
  nextKey += 1;
  return { key: nextKey, set, planned };
}

interface WorkoutSessionProps {
  initial: SessionDraft;
  nameOf: (exerciseId: string) => ResolvedName;
  onSave: (draft: SessionDraft) => Promise<Outcome<object>>;
  onCancel: () => void;
}

export function WorkoutSession({ initial, nameOf, onSave, onCancel }: WorkoutSessionProps) {
  const [entries, setEntries] = useState<EntryRow[]>(() =>
    initial.entries.map((entry) => ({
      exerciseId: entry.exerciseId,
      sets: entry.sets.map((set) => setRow(set, set)),
    })),
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function changeSets(index: number, change: (sets: SetRow[]) => SetRow[]): void {
    setEntries((current) =>
      current.map((entry, i) => (i === index ? { ...entry, sets: change(entry.sets) } : entry)),
    );
  }

  /** A new set starts from the last one, which is what the next set usually is. */
  function addSet(index: number): void {
    changeSets(index, (sets) => {
      const last = sets[sets.length - 1]?.set ?? { reps: '', load: '0' };
      return [...sets, setRow({ ...last }, null)];
    });
  }

  async function save(): Promise<void> {
    setSaving(true);
    setProblem(null);
    try {
      const result = await onSave({
        ...initial,
        entries: entries.map((entry) => ({
          exerciseId: entry.exerciseId,
          sets: entry.sets.map((row) => row.set),
        })),
      });
      if (!result.ok) setProblem(result.message);
    } finally {
      setSaving(false);
    }
  }

  function setField(index: number, key: number, field: keyof SetDraft, text: string): void {
    changeSets(index, (sets) =>
      sets.map((row) => (row.key === key ? { ...row, set: { ...row.set, [field]: text } } : row)),
    );
  }

  const setCount = entries.reduce((total, entry) => total + entry.sets.length, 0);

  return (
    <div class="kitchen kitchen--editing">
      <header class="top-bar top-bar--module">
        <button type="button" class="icon-button" aria-label="Discard workout" onClick={onCancel}>
          <Icon name="close" />
        </button>
        <span class="top-bar__stack">
          <span class="top-bar__kicker">Workout</span>
          <span class="top-bar__name">{initial.routineTitle}</span>
        </span>
        <span class="top-bar__aside">
          {`${entries.length} exercise${entries.length === 1 ? '' : 's'} · ${setCount} set${setCount === 1 ? '' : 's'}`}
        </span>
      </header>

      <main class="kitchen__body editor">
        {entries.map((entry, index) => {
          const { name } = nameOf(entry.exerciseId);
          return (
            // Entries follow the routine's order and are never reordered or removed here,
            // so position is a stable identity for them.
            <ExerciseCard
              key={index}
              name={name}
              sets={entry.sets}
              onField={(key, field, text) => setField(index, key, field, text)}
              onRemove={(key) => changeSets(index, (sets) => sets.filter((r) => r.key !== key))}
              onAdd={() => addSet(index)}
            />
          );
        })}

        {problem === null ? null : <p class="banner banner--error">{problem}</p>}
      </main>

      <footer class="kitchen__actions">
        <button type="button" class="button" disabled={saving} onClick={() => void save()}>
          <Icon name="check" size={20} />
          Save workout
        </button>
      </footer>
    </div>
  );
}
