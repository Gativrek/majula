import type { ItemOfType } from '../data/types.ts';
import { formatLoad } from '../services/workout-draft.ts';
import type { ResolvedName } from '../services/workouts.ts';
import { Icon } from './Icon.tsx';
import { ModuleHeader } from './ModuleHeader.tsx';

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
      <ModuleHeader icon="routine" label="Routine" onBack={onClose} />

      <main class="kitchen__body">
        <h2 class="module-title">{routine.title}</h2>
        {exercises.length === 0 ? (
          <p class="empty">No exercises yet. Tap the pencil to add them.</p>
        ) : (
          <ul class="list">
            {exercises.map((entry, index) => {
              const { name, isDeleted, isUnknown } = nameOf(entry.exercise_id);
              return (
                // Entries have no id of their own; position is their identity inside a
                // payload that is replaced whole on every save.
                <li key={index} class="row">
                  <div class="row__face">
                    <span class="tile">
                      <Icon name="exercise" />
                    </span>
                    <span class="row__text">
                      <span class={isUnknown ? 'row__title workout__name--unknown' : 'row__title'}>
                        {name}
                      </span>
                      {isDeleted ? <span class="row__meta">Deleted from the catalog</span> : null}
                    </span>
                    <span class="row__figure">
                      {`${entry.sets} × ${entry.reps} · ${formatLoad(entry.load_kg)}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer class="kitchen__actions">
        <button
          type="button"
          class="button button--quiet button--square"
          aria-label="Edit routine"
          onClick={onEdit}
        >
          <Icon name="edit" />
        </button>
        <button type="button" class="button" onClick={onStart}>
          <Icon name="workout" size={20} />
          Start workout
        </button>
      </footer>
    </div>
  );
}
