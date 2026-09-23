import { useState } from 'react';
import type { SessionDraft, SetDraft } from '../services/workout-draft.ts';
import type { Outcome, ResolvedName } from '../services/workouts.ts';

/**
 * A workout in progress (`docs/modules/workout.md` criteria 9–10): every exercise of the
 * routine with its sets pre-filled, each changeable, addable and removable. **Save**
 * writes one log; Cancel or back writes nothing (SPECS §2.2, Back).
 */

interface SetRow {
  key: number;
  set: SetDraft;
}

interface EntryRow {
  exerciseId: string;
  sets: SetRow[];
}

let nextKey = 0;
function setRow(set: SetDraft): SetRow {
  nextKey += 1;
  return { key: nextKey, set };
}

interface WorkoutSessionProps {
  initial: SessionDraft;
  nameOf: (exerciseId: string) => ResolvedName;
  onSave: (draft: SessionDraft) => Promise<Outcome<object>>;
  onCancel: () => void;
}

function value(event: Event): string {
  return (event.currentTarget as HTMLInputElement).value;
}

export function WorkoutSession({ initial, nameOf, onSave, onCancel }: WorkoutSessionProps) {
  const [entries, setEntries] = useState<EntryRow[]>(() =>
    initial.entries.map((entry) => ({
      exerciseId: entry.exerciseId,
      sets: entry.sets.map(setRow),
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
      return [...sets, setRow({ ...last })];
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

  return (
    <div class="kitchen kitchen--editing">
      <main class="kitchen__body editor">
        <h2 class="kitchen__title">{initial.routineTitle}</h2>

        {entries.map((entry, index) => {
          const { name } = nameOf(entry.exerciseId);
          return (
            // Entries follow the routine's order and are never reordered or removed here,
            // so position is a stable identity for them.
            <section key={index} class="kitchen__section">
              <h3 class="kitchen__heading">{name}</h3>
              {entry.sets.length === 0 ? <p class="panel__note">Skipped.</p> : null}
              {entry.sets.map((row, setIndex) => (
                <div key={row.key} class="session__set">
                  <span class="editor__step-number">{setIndex + 1}</span>
                  <input
                    class="capture__input routine__number"
                    type="text"
                    inputMode="numeric"
                    aria-label={`${name} set ${setIndex + 1} reps`}
                    value={row.set.reps}
                    onInput={(e) =>
                      changeSets(index, (sets) =>
                        sets.map((r) =>
                          r.key === row.key ? { ...r, set: { ...r.set, reps: value(e) } } : r,
                        ),
                      )
                    }
                  />
                  <span class="session__times">{'×'}</span>
                  <input
                    class="capture__input routine__number"
                    type="text"
                    inputMode="decimal"
                    aria-label={`${name} set ${setIndex + 1} load in kilograms`}
                    value={row.set.load}
                    onInput={(e) =>
                      changeSets(index, (sets) =>
                        sets.map((r) =>
                          r.key === row.key ? { ...r, set: { ...r.set, load: value(e) } } : r,
                        ),
                      )
                    }
                  />
                  <span class="session__unit">kg</span>
                  <button
                    type="button"
                    class="icon-button"
                    aria-label={`Remove ${name} set ${setIndex + 1}`}
                    onClick={() =>
                      changeSets(index, (sets) => sets.filter((r) => r.key !== row.key))
                    }
                  >
                    {'×'}
                  </button>
                </div>
              ))}
              <button type="button" class="button button--quiet" onClick={() => addSet(index)}>
                Add set
              </button>
            </section>
          );
        })}

        {problem === null ? null : <p class="banner banner--error">{problem}</p>}
      </main>

      <footer class="kitchen__actions">
        <button type="button" class="button button--quiet" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" class="button" disabled={saving} onClick={() => void save()}>
          Save workout
        </button>
      </footer>
    </div>
  );
}
