import type { ItemOfType } from '../data/types.ts';
import { formatLoad } from '../services/workout-draft.ts';
import type { ResolvedName } from '../services/workouts.ts';

/**
 * A routine, read (`docs/modules/workout.md` criterion 8): its exercises with their sets,
 * reps and load, and **Start workout** and **Edit** at the thumb.
 */

interface RoutineViewProps {
  routine: ItemOfType<'routine'>;
  nameOf: (exerciseId: string) => ResolvedName;
  onStart: () => void;
  onEdit: () => void;
  onClose: () => void;
}

export function RoutineView({ routine, nameOf, onStart, onEdit, onClose }: RoutineViewProps) {
  const { exercises } = routine.payload;

  return (
    <div class="kitchen kitchen--editing">
      <main class="kitchen__body">
        <h2 class="kitchen__title">{routine.title}</h2>
        <ul class="workout__list">
          {exercises.map((entry, index) => {
            const { name, isDeleted, isUnknown } = nameOf(entry.exercise_id);
            return (
              // Entries have no id of their own; position is their identity inside a
              // payload that is replaced whole on every save.
              <li key={index} class="workout__row">
                <span class={isUnknown ? 'workout__name workout__name--unknown' : 'workout__name'}>
                  {name}
                  {isDeleted ? <span class="routine__deleted"> (deleted)</span> : null}
                </span>
                <span class="workout__numbers">
                  {`${entry.sets} × ${entry.reps} · ${formatLoad(entry.load_kg)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </main>

      <footer class="kitchen__actions">
        <button type="button" class="button button--quiet" onClick={onClose}>
          Close
        </button>
        <button type="button" class="button button--quiet" onClick={onEdit}>
          Edit
        </button>
        <button type="button" class="button" onClick={onStart}>
          Start workout
        </button>
      </footer>
    </div>
  );
}
