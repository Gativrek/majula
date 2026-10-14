import type { ItemOfType } from '../data/types.ts';
import { formatKilograms } from '../services/workout-draft.ts';
import type { ResolvedName } from '../services/workouts.ts';
import { Icon } from './Icon.tsx';
import { ModuleHeader } from './ModuleHeader.tsx';

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
      <ModuleHeader icon="workout" label="Workout" onBack={onClose} />

      <main class="kitchen__body">
        <div class="kitchen__heading-block">
          <h2 class="module-title">{log.title}</h2>
          <p class="kitchen__servings">
            <Icon name="routine" size={18} />
            {routineLine(routine)}
          </p>
        </div>

        {log.payload.performed.map((entry, index) => {
          const { name, isDeleted, isUnknown } = nameOf(entry.exercise_id);
          return (
            // Performed entries have no id; position is their identity in a log that is
            // never edited after it is written.
            <section key={index} class="card">
              <h3 class={isUnknown ? 'card__heading workout__name--unknown' : 'card__heading'}>
                <Icon name="exercise" />
                {isDeleted ? `${name} (deleted)` : name}
              </h3>
              <div class="set-grid set-grid--head set-grid--read" aria-hidden="true">
                <span>Set</span>
                <span>kg</span>
                <span>Reps</span>
              </div>
              {entry.sets.map((set, setIndex) => (
                <div key={setIndex} class="set-grid set-grid--read">
                  <span class="set-grid__number">{setIndex + 1}</span>
                  <span class="set-grid__value">{formatKilograms(set.load_kg)}</span>
                  <span class="set-grid__value">{set.reps}</span>
                </div>
              ))}
            </section>
          );
        })}
      </main>
    </div>
  );
}
