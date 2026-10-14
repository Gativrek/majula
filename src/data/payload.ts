/**
 * Runtime validation of the `payload` column (CODESTYLE §9, §10).
 *
 * `payload` is TEXT. A previous schema version, a hand-edited export or a partial
 * write could have left it in any shape, so static types do not survive the
 * `JSON.parse` boundary: parse, validate, then narrow — never cast.
 */

import { ValidationError } from '../lib/errors.ts';
import { isId } from '../lib/ids.ts';
import type {
  ItemType,
  PayloadByType,
  PerformedExercise,
  PlacePayload,
  ReadingPayload,
  RecipeIngredient,
  RecipePayload,
  RoutineExercise,
  RoutinePayload,
  WorkoutLogPayload,
} from './types.ts';

type Raw = Record<string, unknown>;

function fail(subject: string, detail: string, type: ItemType, id: string | undefined): never {
  throw new ValidationError(`${subject}: ${detail}`, { subject, type, id });
}

function asObject(value: unknown, type: ItemType, id: string | undefined): Raw {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('payload', 'expected a JSON object', type, id);
  }
  return value as Raw;
}

function asArray(value: unknown, field: string, type: ItemType, id: string | undefined): unknown[] {
  if (!Array.isArray(value)) fail(`payload.${field}`, 'expected an array', type, id);
  return value;
}

function asFiniteNumber(
  value: unknown,
  field: string,
  type: ItemType,
  id: string | undefined,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`payload.${field}`, 'expected a finite number', type, id);
  }
  return value;
}

function asString(value: unknown, field: string, type: ItemType, id: string | undefined): string {
  if (typeof value !== 'string') fail(`payload.${field}`, 'expected a string', type, id);
  return value;
}

function asReference(
  value: unknown,
  field: string,
  type: ItemType,
  id: string | undefined,
): string {
  // SPECS §4.1: references inside payload JSON cannot be enforced by SQLite, so their
  // integrity is the data layer's responsibility, checked on write and on read.
  if (!isId(value)) fail(`payload.${field}`, 'expected a UUID reference', type, id);
  return value;
}

function emptyPayload(
  value: unknown,
  type: ItemType,
  id: string | undefined,
): Record<never, never> {
  const raw = asObject(value, type, id);
  if (Object.keys(raw).length > 0) {
    fail('payload', `type ${type} carries no payload fields`, type, id);
  }
  return {};
}

function readingPayload(value: unknown, id: string | undefined): ReadingPayload {
  const raw = asObject(value, 'reading', id);
  const payload: ReadingPayload = {};
  if (raw.pdf_path !== undefined) {
    payload.pdf_path = asString(raw.pdf_path, 'pdf_path', 'reading', id);
  }
  if (raw.page_count !== undefined) {
    payload.page_count = asFiniteNumber(raw.page_count, 'page_count', 'reading', id);
  }
  if (raw.last_page !== undefined) {
    payload.last_page = asFiniteNumber(raw.last_page, 'last_page', 'reading', id);
  }
  if (raw.zoom !== undefined) {
    const zoom = asFiniteNumber(raw.zoom, 'zoom', 'reading', id);
    // reading-queue.md 15b: 100% to 250%. Anything outside is not a view this app draws.
    if (zoom < 1 || zoom > 2.5) fail('payload.zoom', 'must be between 1 and 2.5', 'reading', id);
    payload.zoom = zoom;
  }
  if (raw.trim_margins !== undefined) {
    if (typeof raw.trim_margins !== 'boolean') {
      fail('payload.trim_margins', 'expected true or false', 'reading', id);
    }
    payload.trim_margins = raw.trim_margins;
  }
  return payload;
}

function recipePayload(value: unknown, id: string | undefined): RecipePayload {
  const raw = asObject(value, 'recipe', id);
  const ingredients: RecipeIngredient[] = asArray(raw.ingredients, 'ingredients', 'recipe', id).map(
    function toIngredient(entry, index) {
      const row = asObject(entry, 'recipe', id);
      const where = `ingredients[${index}]`;
      const name = asString(row.name, `${where}.name`, 'recipe', id);
      if (name.trim().length === 0)
        fail(`payload.${where}.name`, 'must not be empty', 'recipe', id);
      const ingredient: RecipeIngredient = { name };
      // SPECS §4.3: absent stays absent. A missing quantity is not zero.
      if (row.qty !== undefined)
        ingredient.qty = asFiniteNumber(row.qty, `${where}.qty`, 'recipe', id);
      if (row.unit !== undefined)
        ingredient.unit = asString(row.unit, `${where}.unit`, 'recipe', id);
      return ingredient;
    },
  );
  const steps = asArray(raw.steps, 'steps', 'recipe', id).map(function toStep(entry, index) {
    return asString(entry, `steps[${index}]`, 'recipe', id);
  });
  const servings = asFiniteNumber(raw.servings, 'servings', 'recipe', id);
  if (servings <= 0) fail('payload.servings', 'must be positive', 'recipe', id);
  return { servings, ingredients, steps };
}

function routinePayload(value: unknown, id: string | undefined): RoutinePayload {
  const raw = asObject(value, 'routine', id);
  const exercises: RoutineExercise[] = asArray(raw.exercises, 'exercises', 'routine', id).map(
    function toRoutineExercise(entry, index) {
      const row = asObject(entry, 'routine', id);
      return {
        exercise_id: asReference(row.exercise_id, `exercises[${index}].exercise_id`, 'routine', id),
        sets: asFiniteNumber(row.sets, `exercises[${index}].sets`, 'routine', id),
        reps: asFiniteNumber(row.reps, `exercises[${index}].reps`, 'routine', id),
        load_kg: asFiniteNumber(row.load_kg, `exercises[${index}].load_kg`, 'routine', id),
      };
    },
  );
  return { exercises };
}

function workoutLogPayload(value: unknown, id: string | undefined): WorkoutLogPayload {
  const raw = asObject(value, 'workout_log', id);
  const performed: PerformedExercise[] = asArray(raw.performed, 'performed', 'workout_log', id).map(
    function toPerformed(entry, index) {
      const row = asObject(entry, 'workout_log', id);
      const sets = asArray(row.sets, `performed[${index}].sets`, 'workout_log', id).map(
        function toSet(setEntry, setIndex) {
          const setRow = asObject(setEntry, 'workout_log', id);
          const where = `performed[${index}].sets[${setIndex}]`;
          return {
            reps: asFiniteNumber(setRow.reps, `${where}.reps`, 'workout_log', id),
            load_kg: asFiniteNumber(setRow.load_kg, `${where}.load_kg`, 'workout_log', id),
          };
        },
      );
      return {
        exercise_id: asReference(
          row.exercise_id,
          `performed[${index}].exercise_id`,
          'workout_log',
          id,
        ),
        sets,
      };
    },
  );
  return { routine_id: asReference(raw.routine_id, 'routine_id', 'workout_log', id), performed };
}

function placePayload(value: unknown, id: string | undefined): PlacePayload {
  const raw = asObject(value, 'place', id);
  // places.md: both or neither. A latitude with no longitude is not a place.
  if ((raw.lat === undefined) !== (raw.lon === undefined)) {
    fail('payload', 'lat and lon must be both present or both absent', 'place', id);
  }
  if (raw.lat === undefined) return {};
  const lat = asFiniteNumber(raw.lat, 'lat', 'place', id);
  const lon = asFiniteNumber(raw.lon, 'lon', 'place', id);
  if (lat < -90 || lat > 90) fail('payload.lat', 'must be between -90 and 90', 'place', id);
  if (lon < -180 || lon > 180) fail('payload.lon', 'must be between -180 and 180', 'place', id);
  return { lat, lon };
}

/**
 * Validate an already-parsed payload against the shape its `type` requires.
 *
 * @throws {ValidationError} when the value does not match the shape for `type`.
 */
export function validatePayload<T extends ItemType>(
  type: T,
  value: unknown,
  id?: string,
): PayloadByType[T] {
  const normalised = value === null || value === undefined ? {} : value;
  switch (type) {
    case 'reading':
      return readingPayload(normalised, id) as PayloadByType[T];
    case 'recipe':
      return recipePayload(normalised, id) as PayloadByType[T];
    case 'routine':
      return routinePayload(normalised, id) as PayloadByType[T];
    case 'workout_log':
      return workoutLogPayload(normalised, id) as PayloadByType[T];
    case 'place':
      return placePayload(normalised, id) as PayloadByType[T];
    default:
      return emptyPayload(normalised, type, id) as PayloadByType[T];
  }
}

/**
 * Parse the `payload` TEXT column and validate it.
 *
 * @throws {ValidationError} on malformed JSON or a shape that does not match `type`.
 */
export function parsePayload<T extends ItemType>(
  type: T,
  text: string | null,
  id?: string,
): PayloadByType[T] {
  if (text === null || text === '') return validatePayload(type, {}, id);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new ValidationError(
      'payload: not valid JSON',
      { subject: 'payload', type, id },
      { cause },
    );
  }
  return validatePayload(type, parsed, id);
}

/** Serialise a payload for the TEXT column, validating it on the way out. */
export function serialisePayload<T extends ItemType>(
  type: T,
  payload: PayloadByType[T] | undefined,
  id?: string,
): string {
  return JSON.stringify(validatePayload(type, payload ?? {}, id));
}
