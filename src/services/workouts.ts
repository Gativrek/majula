/**
 * What the UI may do with exercises, routines and workout logs (`docs/modules/workout.md`).
 */

import { resolveReferences } from '../data/references.ts';
import { setTags } from '../data/tags.ts';
import type { ItemOfType, PerformedSet } from '../data/types.ts';
import { InvariantError } from '../lib/errors.ts';
import { log } from '../lib/logger.ts';
import type { Timestamp } from '../lib/time.ts';
import { todayLocalDate } from '../lib/time.ts';
import type { AppContext } from './database.ts';
import type { RoutineDraft, SessionDraft } from './workout-draft.ts';
import { buildRoutine, buildSession } from './workout-draft.ts';

export type Outcome<T> = ({ ok: true } & T) | { ok: false; message: string };

/** How a referenced exercise or routine reads on screen, however it has fared since. */
export interface ResolvedName {
  id: string;
  name: string;
  isDeleted: boolean;
  /** The row is gone entirely — only possible from a damaged or hand-edited import. */
  isUnknown: boolean;
}

/**
 * Resolve ids to names, deleted rows included (CODESTYLE §10). A reference to a row that
 * no longer exists is logged and shown as "Unknown exercise", never a blank
 * (workout.md criterion 13).
 */
export async function resolveNames(
  context: AppContext,
  ids: Iterable<string>,
  ownerId: string,
): Promise<(id: string) => ResolvedName> {
  const resolved = await resolveReferences(context.driver, ids);
  return function nameOf(id) {
    const hit = resolved.get(id);
    if (hit === undefined) {
      log.error('workout.dangling_reference', { owner: ownerId, target: id });
      return { id, name: 'Unknown exercise', isDeleted: false, isUnknown: true };
    }
    return { id, name: hit.title, isDeleted: hit.isDeleted, isUnknown: false };
  };
}

function sameName(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), undefined, { sensitivity: 'accent' }) === 0;
}

/** Live exercises, by name, for the picker and the Exercises view. */
export async function listExercises(context: AppContext): Promise<ItemOfType<'exercise'>[]> {
  const items = await context.items.list({ type: 'exercise' });
  return items
    .filter((item): item is ItemOfType<'exercise'> => item.type === 'exercise')
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * The picker's Create (workout.md criterion 5). An exercise with the same name already
 * in the catalog is returned instead of duplicated: two "Bench press" entries would split
 * one exercise's history in two, which is what the catalog exists to prevent.
 */
export async function createExercise(
  context: AppContext,
  name: string,
): Promise<Outcome<{ exercise: ItemOfType<'exercise'> }>> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, message: 'An exercise needs a name.' };
  const existing = (await listExercises(context)).find((item) => sameName(item.title, trimmed));
  if (existing !== undefined) return { ok: true, exercise: existing };
  const created = await context.items.create({ type: 'exercise', title: trimmed });
  if (created.type !== 'exercise')
    throw new InvariantError(`created ${created.type}, expected exercise`);
  return { ok: true, exercise: created };
}

/** Rename an exercise and edit its form cues. The rename reaches every routine and log. */
export async function saveExerciseDetails(
  context: AppContext,
  exerciseId: string,
  details: { name: string; cues: string },
): Promise<Outcome<object>> {
  const name = details.name.trim();
  if (name.length === 0) return { ok: false, message: 'An exercise needs a name.' };
  const clash = (await listExercises(context)).find(
    (item) => item.id !== exerciseId && sameName(item.title, name),
  );
  if (clash !== undefined) {
    return { ok: false, message: `Another exercise is already called "${clash.title}".` };
  }
  const cues = details.cues.trim();
  await context.items.update<'exercise'>(exerciseId, {
    title: name,
    body: cues.length === 0 ? null : cues,
  });
  return { ok: true };
}

async function routineNames(context: AppContext, draft: RoutineDraft, ownerId: string) {
  const nameOf = await resolveNames(
    context,
    draft.entries.map((e) => e.exerciseId),
    ownerId,
  );
  return (id: string) => nameOf(id).name;
}

/** The first Save of a routine added from quick capture. Nothing is written before it. */
export async function addRoutine(
  context: AppContext,
  draft: RoutineDraft,
  tags: readonly string[] = [],
): Promise<Outcome<{ routine: ItemOfType<'routine'> }>> {
  const result = buildRoutine(draft, await routineNames(context, draft, 'new-routine'));
  if (!result.ok) return result;
  const created = await context.items.create({
    type: 'routine',
    title: result.title,
    payload: result.payload,
  });
  if (created.type !== 'routine')
    throw new InvariantError(`created ${created.type}, expected routine`);
  if (tags.length > 0) await setTags(context.driver, created.id, tags);
  return { ok: true, routine: created };
}

export async function saveRoutine(
  context: AppContext,
  routineId: string,
  draft: RoutineDraft,
): Promise<Outcome<{ routine: ItemOfType<'routine'> }>> {
  const result = buildRoutine(draft, await routineNames(context, draft, routineId));
  if (!result.ok) return result;
  const updated = await context.items.update<'routine'>(routineId, {
    title: result.title,
    payload: result.payload,
  });
  if (updated.type !== 'routine')
    throw new InvariantError(`updated ${updated.type}, expected routine`);
  return { ok: true, routine: updated };
}

/**
 * Write a finished session as one workout log. Cancelling a session never reaches here,
 * so backing out writes nothing (workout.md criterion 10).
 */
export async function saveSession(
  context: AppContext,
  draft: SessionDraft,
): Promise<Outcome<{ log: ItemOfType<'workout_log'> }>> {
  const nameOf = await resolveNames(
    context,
    draft.entries.map((e) => e.exerciseId),
    'session',
  );
  const result = buildSession(draft, todayLocalDate(), (id) => nameOf(id).name);
  if (!result.ok) return result;
  const created = await context.items.create({
    type: 'workout_log',
    title: result.title,
    payload: result.payload,
  });
  if (created.type !== 'workout_log')
    throw new InvariantError(`created ${created.type}, expected log`);
  return { ok: true, log: created };
}

export interface HistoryEntry {
  logId: string;
  performedAt: Timestamp;
  sets: PerformedSet[];
}

/**
 * Every set of one exercise across live workout logs, newest session first
 * (workout.md criterion 3). A plain list: no totals, no records (SPECS §1.1 item 7).
 */
export async function exerciseHistory(
  context: AppContext,
  exerciseId: string,
): Promise<HistoryEntry[]> {
  const logs = await context.items.list({ type: 'workout_log' });
  const history: HistoryEntry[] = [];
  for (const item of logs) {
    if (item.type !== 'workout_log') continue;
    const sets = item.payload.performed
      .filter((entry) => entry.exercise_id === exerciseId)
      .flatMap((entry) => entry.sets);
    if (sets.length > 0) history.push({ logId: item.id, performedAt: item.createdAt, sets });
  }
  return history;
}
