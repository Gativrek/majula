/**
 * GATE V1 (SPECS §9, ADR-002): is FTS5 compiled into the SQLite the plugin bundles on
 * this Android version?
 *
 * ADR-002 picked FTS5 for global search but could not verify it without a device. This
 * probe answers the question by asking SQLite rather than by assuming, and logs the
 * answer so it can be read off `adb logcat` and recorded in `DECISIONS.md`.
 *
 * It does not choose the search path and it does not configure anything. Phase 2 reads
 * the logged result and ships either `items_fts` or the `LIKE` fallback accordingly.
 * Delete this module once that gate is closed.
 */

import { log } from '../lib/logger.ts';
import type { SqlDriver } from './driver.ts';

export type Fts5Availability = 'available' | 'unavailable';

/**
 * Create and immediately drop a temporary FTS5 table.
 *
 * A temporary table keeps the probe out of the real schema, so it needs no migration
 * and leaves nothing behind for the export writer to trip over.
 *
 * @returns whether the bundled SQLite build has the fts5 module.
 */
export async function probeFts5(driver: SqlDriver): Promise<Fts5Availability> {
  try {
    await driver.executeScript(
      'CREATE VIRTUAL TABLE temp.fts_probe USING fts5(title, body); DROP TABLE temp.fts_probe;',
    );
    log.info('gate_v1.fts5', { availability: 'available' });
    return 'available';
  } catch (cause) {
    // Not a failure of the app: an answer to the gate's question. Phase 2 needs the
    // reason in the log to tell "no such module: fts5" from a real storage fault.
    log.warn('gate_v1.fts5', {
      availability: 'unavailable',
      reason: cause instanceof Error ? cause.message : 'unknown',
    });
    return 'unavailable';
  }
}
