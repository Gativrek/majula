/**
 * Purge: the only path that hard-deletes (SPECS §2.2, §4.1).
 *
 * It is global rather than per-module, and it exists from Phase 1 because soft delete
 * does. Without it, deleted rows accumulate forever and ship inside every export.
 *
 * It keeps back any deleted exercise or routine that something surviving still points at
 * (`docs/modules/workout.md`): purging those would leave a past workout referring to
 * nothing. It is one of the reads allowed to see deleted rows (CODESTYLE §10).
 *
 * The data layer does not touch the filesystem (CODESTYLE §4). It reports which files
 * the purged rows referenced and the service layer removes them.
 */

import { log } from '../lib/logger.ts';
import type { SqlDriver } from './driver.ts';
import { parsePayload } from './payload.ts';
import { isItemType } from './types.ts';

export interface PurgeResult {
  purgedRows: number;
  /** Paths, relative to the app's private data root, whose files are now orphaned. */
  orphanedFiles: string[];
  /** Deleted rows left in place because a surviving routine or log still uses them. */
  keptReferenced: number;
}

interface Row {
  id: string;
  type: string;
  payload: string | null;
}

/** Who points at what: each routine or log, and the exercise and routine ids it holds. */
export interface Referrer {
  id: string;
  targets: string[];
}

function referrersFrom(rows: readonly Row[]): Referrer[] {
  const referrers: Referrer[] = [];
  for (const row of rows) {
    if (row.type === 'routine') {
      const payload = parsePayload('routine', row.payload, row.id);
      referrers.push({
        id: row.id,
        targets: payload.exercises.map((entry) => entry.exercise_id),
      });
    } else if (row.type === 'workout_log') {
      const payload = parsePayload('workout_log', row.payload, row.id);
      referrers.push({
        id: row.id,
        targets: [payload.routine_id, ...payload.performed.map((entry) => entry.exercise_id)],
      });
    }
  }
  return referrers;
}

/**
 * The deleted rows that can actually go.
 *
 * A fixed point: a deleted row that a survivor refers to is held back, which makes it a
 * survivor too, so whatever it refers to is held back in turn. A deleted routine and a
 * deleted exercise used only by it therefore go together in one run.
 */
export function purgeable(
  deleted: ReadonlySet<string>,
  referrers: readonly Referrer[],
): Set<string> {
  const going = new Set(deleted);
  for (;;) {
    const heldBack = new Set<string>();
    for (const referrer of referrers) {
      if (going.has(referrer.id)) continue;
      for (const target of referrer.targets) {
        if (going.has(target)) heldBack.add(target);
      }
    }
    if (heldBack.size === 0) return going;
    for (const id of heldBack) going.delete(id);
  }
}

/** SQLite's default limit on bound parameters is 999; stay well under it. */
const CHUNK = 500;

async function deleteByIds(driver: SqlDriver, ids: readonly string[]): Promise<void> {
  for (let offset = 0; offset < ids.length; offset += CHUNK) {
    const chunk = ids.slice(offset, offset + CHUNK);
    // The placeholders are generated from a count; no data reaches the SQL text.
    const placeholders = chunk.map(() => '?').join(', ');
    await driver.run(`DELETE FROM tags WHERE item_id IN (${placeholders})`, chunk);
    // habit_checks go with their habit through ON DELETE CASCADE (migration 003).
    await driver.run(`DELETE FROM items WHERE id IN (${placeholders})`, chunk);
  }
}

/**
 * Hard-delete every soft-deleted row that nothing surviving still uses, and report the
 * files those rows had attached.
 */
export async function purgeDeleted(driver: SqlDriver): Promise<PurgeResult> {
  const deletedRows = await driver.query<Row>(
    'SELECT id, type, payload FROM items WHERE deleted_at IS NOT NULL',
  );
  const referrerRows = await driver.query<Row>(
    "SELECT id, type, payload FROM items WHERE type IN ('routine', 'workout_log')",
  );

  const going = purgeable(new Set(deletedRows.map((row) => row.id)), referrersFrom(referrerRows));

  const orphanedFiles: string[] = [];
  for (const row of deletedRows) {
    if (!going.has(row.id)) continue;
    if (!isItemType(row.type)) {
      // An unknown type is an invariant violation everywhere else, but refusing to
      // purge a row the schema no longer recognises would leave it stuck forever.
      log.warn('purge.unknown_type', { id: row.id, type: row.type });
      continue;
    }
    if (row.type !== 'reading') continue;
    const payload = parsePayload('reading', row.payload, row.id);
    if (payload.pdf_path !== undefined) orphanedFiles.push(payload.pdf_path);
  }

  await driver.transaction(async function hardDelete() {
    await deleteByIds(driver, [...going]);
  });

  const keptReferenced = deletedRows.length - going.size;
  log.info('purge.done', {
    rows: going.size,
    files: orphanedFiles.length,
    kept_referenced: keptReferenced,
  });
  return { purgedRows: going.size, orphanedFiles, keptReferenced };
}

/** How many rows are soft-deleted, for a confirmation prompt. */
export async function countDeleted(driver: SqlDriver): Promise<number> {
  const rows = await driver.query<{ count: number }>(
    'SELECT COUNT(*) AS count FROM items WHERE deleted_at IS NOT NULL',
  );
  return rows[0]?.count ?? 0;
}
