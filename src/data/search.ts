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
 * Around each matched word in a hit's title and snippet (SPECS §2.2, Global search).
 * Control characters, so nothing the owner typed is mistaken for a mark.
 */
export const MARK_START = '\u0002';
export const MARK_END = '\u0003';

/** Words of body either side of a match: about one line on a phone. */
const SNIPPET_WORDS = 12;

export interface SearchHit {
  item: Item;
  /** The title with its matched words between the marks. */
  markedTitle: string;
  /** The stretch of body around a match, marked the same way; null when only the title matched. */
  markedSnippet: string | null;
}

type HitRow = ItemRow & { marked_title: string | null; marked_body: string | null };

function toHit(row: HitRow): SearchHit {
  const item = toItem(row);
  const body = row.marked_body ?? '';
  return {
    item,
    markedTitle: row.marked_title ?? item.title,
    markedSnippet: body.includes(MARK_START) ? body : null,
  };
}

/**
 * Search live items by title and body, with where each matched.
 *
 * Soft-deleted rows are excluded here rather than in the index: a soft delete is an
 * `UPDATE`, so the sync trigger re-indexes the row and it stays searchable unless the
 * query says otherwise (SPECS §4.2). FTS5's `highlight` and `snippet` read the text back
 * through the external-content table, so they mark exactly what is stored.
 *
 * @returns matches ordered by FTS5 relevance, newest first among equals.
 */
export async function searchHits(
  driver: SqlDriver,
  query: string,
  options: SearchOptions = {},
): Promise<SearchHit[]> {
  const match = toMatchQuery(query);
  if (match === null) return [];

  // The marks are bound like any other value; the column numbers are the table's own.
  const params: SqlValue[] = [MARK_START, MARK_END, MARK_START, MARK_END, match];
  let sql =
    `SELECT ${COLUMNS}, ` +
    'highlight(items_fts, 0, ?, ?) AS marked_title, ' +
    `snippet(items_fts, 1, ?, ?, '…', ${SNIPPET_WORDS}) AS marked_body ` +
    'FROM items_fts JOIN items ON items.rowid = items_fts.rowid ' +
    'WHERE items_fts MATCH ? AND items.deleted_at IS NULL';
  sql += ' ORDER BY rank, items.created_at DESC';
  sql += ' LIMIT ?';
  params.push(options.limit ?? DEFAULT_LIMIT);

  try {
    const rows = await driver.query<HitRow>(sql, params);
    log.debug('search.done', { results: rows.length });
    return rows.map(toHit);
  } catch (cause) {
    throw new StorageError('search failed', { operation: 'searchItems' }, { cause });
  }
}

/** Search live items by title and body, without the marks. */
export async function searchItems(
  driver: SqlDriver,
  query: string,
  options: SearchOptions = {},
): Promise<Item[]> {
  return (await searchHits(driver, query, options)).map((hit) => hit.item);
}
