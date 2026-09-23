import { useEffect, useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import { formatLoad } from '../services/workout-draft.ts';
import type { HistoryEntry, Outcome } from '../services/workouts.ts';

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
  const [name, setName] = useState(exercise.title);
  const [cues, setCues] = useState(exercise.body ?? '');
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const isDirty = name !== exercise.title || cues !== (exercise.body ?? '');

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
      <main class="kitchen__body editor">
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
          class="button button--quiet"
          disabled={busy || !isDirty}
          onClick={() => void save()}
        >
          Save name and cues
        </button>

        {message === null ? null : (
          <p class={message.kind === 'error' ? 'banner banner--error' : 'banner banner--info'}>
            {message.text}
          </p>
        )}

        <section class="kitchen__section place__location">
          <h3 class="kitchen__heading">History</h3>
          {history === null ? <p class="panel__note">Loading…</p> : null}
          {history !== null && history.length === 0 ? (
            <p class="panel__note">Not performed yet.</p>
          ) : null}
          {(history ?? []).map((entry) => (
            <div key={entry.logId} class="history__session">
              <div class="history__day">{sessionDay(entry.performedAt)}</div>
              <div class="history__sets">
                {entry.sets.map((set) => `${set.reps} × ${formatLoad(set.load_kg)}`).join('  ·  ')}
              </div>
            </div>
          ))}
        </section>
      </main>

      <footer class="kitchen__actions">
        <button type="button" class="button button--quiet" onClick={onClose}>
          Close
        </button>
      </footer>
    </div>
  );
}
