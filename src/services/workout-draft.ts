/**
 * The routine editor's and the workout session's form state, and the one place each
 * becomes a payload (`docs/modules/workout.md`).
 *
 * Pure, so every rule about what the owner typed — whole-number sets and reps, a load of
 * `22,5`, an ambiguous `1.000` — is a test rather than something discovered at the gym.
 */

import type { LocalDate } from '../lib/time.ts';
import type { PerformedExercise, RoutinePayload, WorkoutLogPayload } from '../data/types.ts';
import { parseQuantity, quantityProblem } from './quantity.ts';

/** Every numeric field is the string its input holds. Nothing is parsed until save. */
export interface RoutineEntryDraft {
  exerciseId: string;
  sets: string;
  reps: string;
  load: string;
}

export interface RoutineDraft {
  title: string;
  entries: RoutineEntryDraft[];
}

export interface SetDraft {
  reps: string;
  load: string;
}

export interface SessionEntryDraft {
  exerciseId: string;
  sets: SetDraft[];
}

export interface SessionDraft {
  routineId: string;
  routineTitle: string;
  entries: SessionEntryDraft[];
}

type Refusal = { ok: false; message: string };

export type RoutineResult = { ok: true; title: string; payload: RoutinePayload } | Refusal;
export type SessionResult = { ok: true; title: string; payload: WorkoutLogPayload } | Refusal;

/** Defaults for an exercise just added to a routine: plain, and all visible in the form. */
export const NEW_ENTRY_DEFAULTS = { sets: '3', reps: '10', load: '0' } as const;

function wholeNumberAboveZero(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

/** A load in kilograms. `0` is a real load — bodyweight — not a missing one (workout.md 6). */
function parseLoad(raw: string, subject: string): number | Refusal {
  const parsed = parseQuantity(raw);
  if (parsed === undefined) {
    return { ok: false, message: `${subject} needs a load. Use 0 for bodyweight.` };
  }
  if (parsed === 'invalid' || parsed === 'ambiguous') {
    return { ok: false, message: quantityProblem(parsed, subject, raw) };
  }
  if (parsed < 0) return { ok: false, message: `${subject} cannot be negative.` };
  return parsed;
}

export function newRoutineDraft(title: string): RoutineDraft {
  return { title, entries: [] };
}

export function draftFromRoutine(title: string, payload: RoutinePayload): RoutineDraft {
  return {
    title,
    entries: payload.exercises.map((entry) => ({
      exerciseId: entry.exercise_id,
      sets: String(entry.sets),
      reps: String(entry.reps),
      load: String(entry.load_kg),
    })),
  };
}

/**
 * Turn the routine editor's state into a payload, or say which exercise is wrong.
 *
 * @param nameOf the exercise's current name, so a refusal can say which one it means.
 */
export function buildRoutine(
  draft: RoutineDraft,
  nameOf: (exerciseId: string) => string,
): RoutineResult {
  const title = draft.title.trim();
  if (title.length === 0) return { ok: false, message: 'A routine needs a name.' };
  if (draft.entries.length === 0) return { ok: false, message: 'Add at least one exercise.' };

  const exercises: RoutinePayload['exercises'] = [];
  for (const entry of draft.entries) {
    const name = nameOf(entry.exerciseId);
    const sets = wholeNumberAboveZero(entry.sets);
    if (sets === null) {
      return { ok: false, message: `${name}: sets must be a whole number above zero.` };
    }
    const reps = wholeNumberAboveZero(entry.reps);
    if (reps === null) {
      return { ok: false, message: `${name}: reps must be a whole number above zero.` };
    }
    const load = parseLoad(entry.load, `${name}'s load`);
    if (typeof load !== 'number') return load;
    exercises.push({ exercise_id: entry.exerciseId, sets, reps, load_kg: load });
  }
  return { ok: true, title, payload: { exercises } };
}

/** A session pre-filled from the routine: each exercise, each set, at the template's numbers. */
export function sessionFromRoutine(routine: {
  id: string;
  title: string;
  payload: RoutinePayload;
}): SessionDraft {
  return {
    routineId: routine.id,
    routineTitle: routine.title,
    entries: routine.payload.exercises.map((entry) => ({
      exerciseId: entry.exercise_id,
      sets: Array.from({ length: entry.sets }, () => ({
        reps: String(entry.reps),
        load: String(entry.load_kg),
      })),
    })),
  };
}

/**
 * Turn a finished session into a workout log, titled with the routine and the local date
 * (workout.md criterion 10).
 *
 * An exercise whose sets were all removed was skipped, and is left out of the log. A
 * session with no sets at all is refused: there is nothing to have logged.
 */
export function buildSession(
  draft: SessionDraft,
  today: LocalDate,
  nameOf: (exerciseId: string) => string,
): SessionResult {
  const performed: PerformedExercise[] = [];
  for (const entry of draft.entries) {
    if (entry.sets.length === 0) continue;
    const name = nameOf(entry.exerciseId);
    const sets: PerformedExercise['sets'] = [];
    for (const [index, set] of entry.sets.entries()) {
      const subject = `${name}, set ${index + 1}`;
      const reps = wholeNumberAboveZero(set.reps);
      if (reps === null) {
        return { ok: false, message: `${subject}: reps must be a whole number above zero.` };
      }
      const load = parseLoad(set.load, `${subject}'s load`);
      if (typeof load !== 'number') return load;
      sets.push({ reps, load_kg: load });
    }
    performed.push({ exercise_id: entry.exerciseId, sets });
  }
  if (performed.length === 0) return { ok: false, message: 'There are no sets to save.' };

  return {
    ok: true,
    title: `${draft.routineTitle} — ${today}`,
    payload: { routine_id: draft.routineId, performed },
  };
}

/** A load as the owner reads it. The device's locale formats it, so 22.5 reads as 22,5. */
export function formatLoad(kilograms: number): string {
  return `${kilograms.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
}
