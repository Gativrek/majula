/**
 * Global search across the title and body of every type (SPECS §2.2).
 *
 * GATE V1 closed on FTS5 being available on the device, so this is the only search path
 * and there is no `LIKE` fallback to fall into silently (CODESTYLE §6).
 */

import { StorageError } from '../lib/errors.ts';
import { log } from '../lib/logger.ts';
import type { SqlDriver, SqlValue } from './driver.ts';
import type { ItemRow } from './items.ts';
import { toItem } from './items.ts';
import type { Item } from './types.ts';

const COLUMNS = [
  'items.id',
  'items.type',
  'items.title',
  'items.body',
  'items.url',
  'items.done',
  'items.payload',
  'items.created_at',
  'items.updated_at',
  'items.deleted_at',
].join(', ');

const DEFAULT_LIMIT = 100;

/**
 * Turn what the owner typed into an FTS5 MATCH expression.
 *
 * Raw input cannot go into MATCH: FTS5 has its own query syntax, so a stray quote, a
 * bare `-`, or the word `NEAR` would either throw or mean something the typist did not
 * intend. Every token is quoted, which makes it a literal, and the internal quotes are
 * doubled. A trailing `*` on each token gives prefix matching, so a search starts finding
 * things before the word is fully typed — the whole point on a phone.
 *
 * @returns the MATCH expression, or null when there is nothing to search for.
 */
export function toMatchQuery(raw: string): string | null {
  const tokens = raw
    .split(/\s+/)
    .map((token) => token.replace(/"/g, '""').trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return null;
  return tokens.map((token) => `"${token}"*`).join(' ');
}

export interface SearchOptions {
  limit?: number;
}

/**
 * Search live items by title and body.
 *
 * Soft-deleted rows are excluded here rather than in the index: a soft delete is an
 * `UPDATE`, so the sync trigger re-indexes the row and it stays searchable unless the
 * query says otherwise (SPECS §4.2).
 *
 * @returns matches ordered by FTS5 relevance, newest first among equals.
 */
export async function searchItems(
  driver: SqlDriver,
  query: string,
  options: SearchOptions = {},
): Promise<Item[]> {
  const match = toMatchQuery(query);
  if (match === null) return [];

  const params: SqlValue[] = [match];
  let sql =
    `SELECT ${COLUMNS} FROM items_fts ` +
    'JOIN items ON items.rowid = items_fts.rowid ' +
    'WHERE items_fts MATCH ? AND items.deleted_at IS NULL';
  sql += ' ORDER BY rank, items.created_at DESC';
  sql += ' LIMIT ?';
  params.push(options.limit ?? DEFAULT_LIMIT);

  try {
    const rows = await driver.query<ItemRow>(sql, params);
    log.debug('search.done', { results: rows.length });
    return rows.map(toItem);
  } catch (cause) {
    throw new StorageError('search failed', { operation: 'searchItems' }, { cause });
  }
}
