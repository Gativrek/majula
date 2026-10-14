import { useEffect, useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import { formatLoad } from '../services/workout-draft.ts';
import type { HistoryEntry, Outcome } from '../services/workouts.ts';
import { ModuleHeader } from './ModuleHeader.tsx';
import { useBackStep } from './use-back-step.ts';

/**
 * One exercise (`docs/modules/workout.md` criteria 1–3): its name and form cues, and its
 * history as a plain list of past sets, newest session first. No charts, records or
 * totals (SPECS §1.1 item 7).
 */

interface ExerciseDetailProps {
  exercise: ItemOfType<'exercise'>;
  loadHistory: () => Promise<HistoryEntry[]>;
  onSave: (details: { name: string; cues: string }) => Promise<Outcome<object>>;
  onClose: () => void;
}

/** The session's local calendar day, which is how the owner remembers a workout. */
function sessionDay(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ExerciseDetail({ exercise, loadHistory, onSave, onClose }: ExerciseDetailProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(exercise.title);
  const [cues, setCues] = useState(exercise.body ?? '');
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const isDirty = name !== exercise.title || cues !== (exercise.body ?? '');

  // SPECS §2.2, Back: an edit in progress is cancelled, never saved.
  useBackStep(editing, cancelEdit);

  function cancelEdit(): void {
    setName(exercise.title);
    setCues(exercise.body ?? '');
    setEditing(false);
  }

  useEffect(
    function loadExerciseHistory() {
      let current = true;
      async function load(): Promise<void> {
        const loaded = await loadHistory();
        if (current) setHistory(loaded);
      }
      void load();
      return function stale() {
        current = false;
      };
    },
    [loadHistory],
  );

  async function save(): Promise<void> {
    setBusy(true);
    try {
      const result = await onSave({ name, cues });
      if (result.ok) setEditing(false);
      setMessage(
        result.ok
          ? { kind: 'info', text: 'Saved. The new name shows in every routine and past workout.' }
          : { kind: 'error', text: result.message },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="kitchen kitchen--editing">
      <ModuleHeader
        icon="exercise"
        label="Exercise"
        onBack={onClose}
        edit={{
          editing,
          label: 'Edit name and cues',
          onToggle: () => (editing ? cancelEdit() : setEditing(true)),
        }}
      />

      <main class="kitchen__body editor">
        {editing ? (
          <>
            <label class="editor__field">
              <span class="editor__label">Exercise</span>
              <input
                class="capture__input"
                type="text"
                value={name}
                onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
              />
            </label>
            <label class="editor__field">
              <span class="editor__label">Form cues</span>
              <textarea
                class="capture__input editor__step-text"
                rows={3}
                value={cues}
                placeholder="Optional"
                onInput={(e) => setCues((e.currentTarget as HTMLTextAreaElement).value)}
              />
            </label>
            <button
              type="button"
              class="button"
              disabled={busy || !isDirty}
              onClick={() => void save()}
            >
              Save name and cues
            </button>
          </>
        ) : (
          <div class="kitchen__heading-block">
            <h2 class="module-title">{exercise.title}</h2>
            {exercise.body === null ? null : <p class="module-body">{exercise.body}</p>}
          </div>
        )}

        {message === null ? null : (
          <p class={message.kind === 'error' ? 'banner banner--error' : 'banner banner--info'}>
            {message.text}
          </p>
        )}

        <section class="kitchen__section">
          <h3 class="kitchen__heading">History</h3>
          {history === null ? <p class="panel__note">Loading…</p> : null}
          {history !== null && history.length === 0 ? (
            <p class="panel__note">Not performed yet.</p>
          ) : null}
          {history === null || history.length === 0 ? null : (
            <ul class="list">
              {history.map((entry) => (
                <li key={entry.logId} class="row">
                  <div class="row__face">
                    <span class="row__text">
                      <span class="row__title">{sessionDay(entry.performedAt)}</span>
                      <span class="row__meta row__meta--wrap">
                        {entry.sets
                          .map((set) => `${set.reps} × ${formatLoad(set.load_kg)}`)
                          .join('  ·  ')}
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
