import { useState } from 'react';
import type { SetDraft } from '../services/workout-draft.ts';
import { Icon } from './Icon.tsx';
import { isChanged, summariseSets } from './set-summary.ts';

/**
 * One exercise in a workout in progress: its sets as a kg and reps grid, each changeable
 * and removable, and Add set. A set changed from what the routine pre-filled is outlined
 * in gold. Tapping the name folds the card to one line, for exercises already done.
 */

export interface SetRow {
  key: number;
  set: SetDraft;
  /** What the routine pre-filled, or null for a set added during the workout. */
  planned: SetDraft | null;
}

interface ExerciseCardProps {
  name: string;
  sets: readonly SetRow[];
  onField: (key: number, field: keyof SetDraft, text: string) => void;
  onRemove: (key: number) => void;
  onAdd: () => void;
}

function value(event: Event): string {
  return (event.currentTarget as HTMLInputElement).value;
}

export function ExerciseCard({ name, sets, onField, onRemove, onAdd }: ExerciseCardProps) {
  const [folded, setFolded] = useState(false);

  return (
    <section class={folded ? 'card card--folded' : 'card'}>
      <button
        type="button"
        class="card__fold"
        aria-expanded={!folded}
        onClick={() => setFolded(!folded)}
      >
        <Icon name="exercise" />
        <span class="card__fold-name">{name}</span>
        {folded ? (
          <span class="card__fold-summary">{summariseSets(sets.map((row) => row.set))}</span>
        ) : null}
        <Icon name="chevronDown" size={18} />
      </button>

      {folded ? null : (
        <>
          {sets.length === 0 ? (
            <p class="panel__note">Skipped.</p>
          ) : (
            <div class="set-grid set-grid--head" aria-hidden="true">
              <span>Set</span>
              <span>kg</span>
              <span>Reps</span>
            </div>
          )}
          {sets.map((row, index) => (
            <div
              key={row.key}
              class={isChanged(row.set, row.planned) ? 'set-grid set-grid--changed' : 'set-grid'}
            >
              <span class="set-grid__number">{index + 1}</span>
              <input
                class="set-grid__input"
                type="text"
                inputMode="decimal"
                aria-label={`${name} set ${index + 1} load in kilograms`}
                value={row.set.load}
                onInput={(e) => onField(row.key, 'load', value(e))}
              />
              <input
                class="set-grid__input"
                type="text"
                inputMode="numeric"
                aria-label={`${name} set ${index + 1} reps`}
                value={row.set.reps}
                onInput={(e) => onField(row.key, 'reps', value(e))}
              />
              <button
                type="button"
                class="icon-button"
                aria-label={`Remove ${name} set ${index + 1}`}
                onClick={() => onRemove(row.key)}
              >
                <Icon name="minus" size={18} />
              </button>
            </div>
          ))}
          <button type="button" class="dashed-button" onClick={onAdd}>
            <Icon name="plus" size={18} />
            Add set
          </button>
        </>
      )}
    </section>
  );
}
