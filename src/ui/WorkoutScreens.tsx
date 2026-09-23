import { useCallback, useEffect, useRef, useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import { backStack } from '../services/back-stack.ts';
import type { AppContext } from '../services/database.ts';
import type { RoutineDraft, SessionDraft } from '../services/workout-draft.ts';
import { draftFromRoutine, sessionFromRoutine } from '../services/workout-draft.ts';
import type { ResolvedName } from '../services/workouts.ts';
import {
  addRoutine,
  createExercise,
  exerciseHistory,
  listExercises,
  resolveNames,
  saveExerciseDetails,
  saveRoutine,
  saveSession,
} from '../services/workouts.ts';
import { ExerciseDetail } from './ExerciseDetail.tsx';
import { RoutineEditor } from './RoutineEditor.tsx';
import { RoutineView } from './RoutineView.tsx';
import { WorkoutLogView } from './WorkoutLogView.tsx';
import { WorkoutSession } from './WorkoutSession.tsx';

/**
 * The workout module's screens (`docs/modules/workout.md`), with their own navigation,
 * kept out of `App.tsx` (DECISIONS.md, 2026-09-23).
 *
 * Screens form a stack. Close, Cancel and the back button each pop exactly one; popping
 * the last closes the module (SPECS §2.2, Back).
 */

export type WorkoutScreen =
  | { kind: 'routine'; routine: ItemOfType<'routine'> }
  | { kind: 'routine-edit'; routine: ItemOfType<'routine'> }
  | { kind: 'routine-new'; draft: RoutineDraft; tags: string[] }
  | { kind: 'session'; draft: SessionDraft }
  | { kind: 'log'; log: ItemOfType<'workout_log'> }
  | { kind: 'exercise'; exercise: ItemOfType<'exercise'> };

interface WorkoutScreensProps {
  context: AppContext;
  initial: WorkoutScreen;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

/** The ids a screen shows names for. */
function referencedIds(screen: WorkoutScreen): string[] {
  switch (screen.kind) {
    case 'routine':
    case 'routine-edit':
      return screen.routine.payload.exercises.map((entry) => entry.exercise_id);
    case 'routine-new':
    case 'session':
      return screen.draft.entries.map((entry) => entry.exerciseId);
    case 'log':
      return [
        screen.log.payload.routine_id,
        ...screen.log.payload.performed.map((entry) => entry.exercise_id),
      ];
    case 'exercise':
      return [];
  }
}

function ownerOf(screen: WorkoutScreen): string {
  if (screen.kind === 'routine' || screen.kind === 'routine-edit') return screen.routine.id;
  if (screen.kind === 'log') return screen.log.id;
  if (screen.kind === 'exercise') return screen.exercise.id;
  return screen.kind;
}

function nothingToResolve(id: string): ResolvedName {
  return { id, name: '', isDeleted: false, isUnknown: false };
}

export function WorkoutScreens({ context, initial, onClose, onChanged }: WorkoutScreensProps) {
  const [stack, setStack] = useState<WorkoutScreen[]>([initial]);
  // A resolver belongs to the screen it was built for. Reusing one across screens would
  // look up ids it never loaded, show "Unknown exercise" and log a false dangling reference.
  const [resolved, setResolved] = useState<{
    screen: WorkoutScreen;
    nameOf: (id: string) => ResolvedName;
  } | null>(null);
  const top = stack[stack.length - 1] ?? initial;

  const pop = useCallback(
    function popScreen() {
      if (stack.length <= 1) onClose();
      else setStack((current) => current.slice(0, -1));
    },
    [stack.length, onClose],
  );

  // One back entry while the module is open, re-registered whenever the depth changes, so
  // back always pops exactly the screen on top however many there are.
  const latestPop = useRef(pop);
  latestPop.current = pop;
  useEffect(
    function backPopsOneScreen() {
      return backStack().push(function popOnBack() {
        latestPop.current();
      });
    },
    [stack.length],
  );

  useEffect(
    function resolveNamesForScreen() {
      let current = true;
      async function resolve(): Promise<void> {
        const resolver = await resolveNames(context, referencedIds(top), ownerOf(top));
        if (current) setResolved({ screen: top, nameOf: resolver });
      }
      void resolve();
      return function stale() {
        current = false;
      };
    },
    [context, top],
  );

  const push = (screen: WorkoutScreen) => setStack((current) => [...current, screen]);
  const replaceTop = (screen: WorkoutScreen) =>
    setStack((current) => [...current.slice(0, -1), screen]);

  const loadExercises = useCallback(() => listExercises(context), [context]);
  const onCreateExercise = useCallback((name: string) => createExercise(context, name), [context]);
  const exerciseId = top.kind === 'exercise' ? top.exercise.id : null;
  const loadHistory = useCallback(
    () => (exerciseId === null ? Promise.resolve([]) : exerciseHistory(context, exerciseId)),
    [context, exerciseId],
  );

  // A screen with nothing to resolve renders at once, so saving an exercise does not
  // remount its screen and lose the confirmation.
  const nameOf =
    resolved?.screen === top
      ? resolved.nameOf
      : referencedIds(top).length === 0
        ? nothingToResolve
        : null;
  if (nameOf === null) return <p class="empty">Opening…</p>;

  switch (top.kind) {
    case 'routine':
      return (
        <RoutineView
          routine={top.routine}
          nameOf={nameOf}
          onStart={() => push({ kind: 'session', draft: sessionFromRoutine(top.routine) })}
          onEdit={() => push({ kind: 'routine-edit', routine: top.routine })}
          onClose={pop}
        />
      );

    case 'routine-edit':
      return (
        <RoutineEditor
          initial={draftFromRoutine(top.routine.title, top.routine.payload)}
          nameOf={nameOf}
          loadExercises={loadExercises}
          onCreateExercise={onCreateExercise}
          onSave={async (draft) => {
            const result = await saveRoutine(context, top.routine.id, draft);
            if (result.ok) {
              // Back to the routine, showing what was just saved.
              setStack((current) => [
                ...current.slice(0, -2),
                { kind: 'routine', routine: result.routine },
              ]);
              await onChanged();
            }
            return result;
          }}
          onCancel={pop}
        />
      );

    case 'routine-new':
      return (
        <RoutineEditor
          initial={top.draft}
          nameOf={nameOf}
          loadExercises={loadExercises}
          onCreateExercise={onCreateExercise}
          onSave={async (draft) => {
            const result = await addRoutine(context, draft, top.tags);
            if (result.ok) {
              replaceTop({ kind: 'routine', routine: result.routine });
              await onChanged();
            }
            return result;
          }}
          onCancel={pop}
        />
      );

    case 'session':
      return (
        <WorkoutSession
          initial={top.draft}
          nameOf={nameOf}
          onSave={async (draft) => {
            const result = await saveSession(context, draft);
            if (result.ok) {
              replaceTop({ kind: 'log', log: result.log });
              await onChanged();
            }
            return result;
          }}
          onCancel={pop}
        />
      );

    case 'log':
      return <WorkoutLogView log={top.log} nameOf={nameOf} onClose={pop} />;

    case 'exercise':
      return (
        <ExerciseDetail
          key={top.exercise.id}
          exercise={top.exercise}
          loadHistory={loadHistory}
          onSave={async (details) => {
            const result = await saveExerciseDetails(context, top.exercise.id, details);
            if (result.ok) {
              const fresh = await context.items.get(top.exercise.id);
              if (fresh?.type === 'exercise') replaceTop({ kind: 'exercise', exercise: fresh });
              await onChanged();
            }
            return result;
          }}
          onClose={pop}
        />
      );
  }
}
