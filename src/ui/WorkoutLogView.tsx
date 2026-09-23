import type { ItemOfType } from '../data/types.ts';
import { formatLoad } from '../services/workout-draft.ts';
import type { ResolvedName } from '../services/workouts.ts';

/**
 * One performed session (`docs/modules/workout.md` criteria 11–13). Exercise names are
 * resolved by id each time, so a rename in the catalog shows here; a deleted exercise
 * still shows its name, and a deleted routine is named as such.
 */

interface WorkoutLogViewProps {
  log: ItemOfType<'workout_log'>;
  nameOf: (id: string) => ResolvedName;
  onClose: () => void;
}

function routineLine(routine: ResolvedName): string {
  if (routine.isUnknown) return 'From a routine that no longer exists';
  if (routine.isDeleted) return 'From a deleted routine';
  return `From ${routine.name}`;
}

export function WorkoutLogView({ log, nameOf, onClose }: WorkoutLogViewProps) {
  const routine = nameOf(log.payload.routine_id);

  return (
    <div class="kitchen kitchen--editing">
      <main class="kitchen__body">
        <h2 class="kitchen__title">{log.title}</h2>
        <p class="kitchen__servings">{routineLine(routine)}</p>

        {log.payload.performed.map((entry, index) => {
          const { name, isDeleted, isUnknown } = nameOf(entry.exercise_id);
          return (
            // Performed entries have no id; position is their identity in a log that is
            // never edited after it is written.
            <section key={index} class="kitchen__section">
              <h3
                class={isUnknown ? 'kitchen__heading workout__name--unknown' : 'kitchen__heading'}
              >
                {name}
                {isDeleted ? ' (deleted)' : ''}
              </h3>
              <ol class="workout__sets">
                {entry.sets.map((set, setIndex) => (
                  <li key={setIndex}>{`${set.reps} × ${formatLoad(set.load_kg)}`}</li>
                ))}
              </ol>
            </section>
          );
        })}
      </main>

      <footer class="kitchen__actions">
        <button type="button" class="button button--quiet" onClick={onClose}>
          Close
        </button>
      </footer>
    </div>
  );
}
