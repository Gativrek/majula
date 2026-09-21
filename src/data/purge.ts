/**
 * Purge: the only path that hard-deletes (SPECS §2.2, §4.1).
 *
 * It is global rather than per-module, and it exists from Phase 1 because soft delete
 * does. Without it, deleted rows accumulate forever and ship inside every export.
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
}

/**
 * Hard-delete every soft-deleted row and report its attached files.
 *
 * @returns the number of rows removed and the files the caller must now unlink.
 */
export async function purgeDeleted(driver: SqlDriver): Promise<PurgeResult> {
  const doomed = await driver.query<{ id: string; type: string; payload: string | null }>(
    'SELECT id, type, payload FROM items WHERE deleted_at IS NOT NULL',
  );

  const orphanedFiles: string[] = [];
  for (const row of doomed) {
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
    await driver.run(
      'DELETE FROM tags WHERE item_id IN (SELECT id FROM items WHERE deleted_at IS NOT NULL)',
    );
    await driver.run('DELETE FROM items WHERE deleted_at IS NOT NULL');
  });

  log.info('purge.done', { rows: doomed.length, files: orphanedFiles.length });
  return { purgedRows: doomed.length, orphanedFiles };
}

/** How many rows a purge would remove, for a confirmation prompt. */
export async function countDeleted(driver: SqlDriver): Promise<number> {
  const rows = await driver.query<{ count: number }>(
    'SELECT COUNT(*) AS count FROM items WHERE deleted_at IS NOT NULL',
  );
  return rows[0]?.count ?? 0;
}
