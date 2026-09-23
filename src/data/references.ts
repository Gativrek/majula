/**
 * References held inside `payload` JSON: a routine's and a log's `exercise_id`s, and a
 * log's `routine_id` (SPECS §4.1). SQLite cannot enforce these, so this module does, on
 * write and on read.
 *
 * It is one of the three reads allowed to see soft-deleted rows (CODESTYLE §10): a past
 * workout must still show an exercise deleted since (`docs/modules/workout.md`). It only
 * ever resolves the ids it is given. It never lists, so a deleted exercise cannot leak
 * into the catalog or the picker through here.
 */

import { ValidationError } from '../lib/errors.ts';
import type { SqlDriver } from './driver.ts';
import type { Item, ItemType } from './types.ts';
import { isItemType } from './types.ts';

export interface ResolvedReference {
  id: string;
  type: ItemType;
  title: string;
  isDeleted: boolean;
}

/** SQLite's default limit on bound parameters is 999; stay well under it. */
const CHUNK = 500;

/** Resolve ids to their rows, soft-deleted or not. An id with no row is simply absent. */
export async function resolveReferences(
  driver: SqlDriver,
  ids: Iterable<string>,
): Promise<Map<string, ResolvedReference>> {
  const unique = [...new Set(ids)];
  const resolved = new Map<string, ResolvedReference>();
  for (let offset = 0; offset < unique.length; offset += CHUNK) {
    const chunk = unique.slice(offset, offset + CHUNK);
    // The placeholders are generated from a count; no data reaches the SQL text.
    const placeholders = chunk.map(() => '?').join(', ');
    const rows = await driver.query<{
      id: string;
      type: string;
      title: string;
      deleted_at: string | null;
    }>(`SELECT id, type, title, deleted_at FROM items WHERE id IN (${placeholders})`, chunk);
    for (const row of rows) {
      if (!isItemType(row.type)) continue;
      resolved.set(row.id, {
        id: row.id,
        type: row.type,
        title: row.title,
        isDeleted: row.deleted_at !== null,
      });
    }
  }
  return resolved;
}

export interface PayloadReferences {
  exerciseIds: string[];
  routineIds: string[];
}

/** Every reference an item's payload holds. Types that hold none return empty lists. */
export function referencesIn(item: Item): PayloadReferences {
  if (item.type === 'routine') {
    return {
      exerciseIds: item.payload.exercises.map((entry) => entry.exercise_id),
      routineIds: [],
    };
  }
  if (item.type === 'workout_log') {
    return {
      exerciseIds: item.payload.performed.map((entry) => entry.exercise_id),
      routineIds: [item.payload.routine_id],
    };
  }
  return { exerciseIds: [], routineIds: [] };
}

/**
 * Refuse a written item whose payload points at something that is not what it claims.
 * Called inside the write's transaction, so throwing rolls the write back.
 *
 * A soft-deleted target is allowed: an existing routine may still hold an exercise deleted
 * since, and re-saving it must not fail for that (workout.md criterion 14).
 *
 * @throws {ValidationError} naming the reference that does not resolve.
 */
export async function checkReferencesOnWrite(driver: SqlDriver, item: Item): Promise<void> {
  const { exerciseIds, routineIds } = referencesIn(item);
  if (exerciseIds.length === 0 && routineIds.length === 0) return;

  const resolved = await resolveReferences(driver, [...exerciseIds, ...routineIds]);
  const context = { type: item.type, id: item.id };
  if (exerciseIds.some((exerciseId) => resolved.get(exerciseId)?.type !== 'exercise')) {
    throw new ValidationError('payload refers to an exercise that does not exist', {
      subject: 'payload.exercise_id',
      ...context,
    });
  }
  if (routineIds.some((routineId) => resolved.get(routineId)?.type !== 'routine')) {
    throw new ValidationError('payload refers to a routine that does not exist', {
      subject: 'payload.routine_id',
      ...context,
    });
  }
}
