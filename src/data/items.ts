/**
 * Every statement against `items` lives here (CODESTYLE §4, §10).
 *
 * Every read filters `deleted_at IS NULL` except the purge paths, which say so in
 * their names. Parameterised queries only.
 */

import { StorageError } from '../lib/errors.ts';
import type { IdGenerator } from '../lib/ids.ts';
import { randomId } from '../lib/ids.ts';
import { log } from '../lib/logger.ts';
import type { Clock, Timestamp } from '../lib/time.ts';
import { nowTimestamp, systemClock } from '../lib/time.ts';
import type { SqlDriver, SqlValue } from './driver.ts';
import { queryOne } from './driver.ts';
import { parsePayload, serialisePayload } from './payload.ts';
import type { Item, ItemPatch, ItemType, NewItem } from './types.ts';
import { isItemType } from './types.ts';

export interface ItemRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  done: number;
  payload: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const COLUMNS = 'id, type, title, body, url, done, payload, created_at, updated_at, deleted_at';

/** Storage row to domain item. Validates the payload on read (CODESTYLE §10). */
export function toItem(row: ItemRow): Item {
  if (!isItemType(row.type)) {
    throw new StorageError(`unknown items.type "${row.type}"`, {
      operation: 'toItem',
      type: row.type,
      id: row.id,
    });
  }
  const type: ItemType = row.type;
  return {
    id: row.id,
    type,
    title: row.title,
    body: row.body,
    url: row.url,
    done: row.done !== 0,
    payload: parsePayload(type, row.payload, row.id),
    createdAt: row.created_at as Timestamp,
    updatedAt: row.updated_at as Timestamp,
    deletedAt: row.deleted_at as Timestamp | null,
  } as Item;
}

export interface ItemStoreOptions {
  clock?: Clock;
  newId?: IdGenerator;
}

export interface ListItemsFilter {
  type?: ItemType;
  limit?: number;
}

export class ItemStore {
  private readonly driver: SqlDriver;
  private readonly clock: Clock;
  private readonly newId: IdGenerator;

  constructor(driver: SqlDriver, options: ItemStoreOptions = {}) {
    this.driver = driver;
    this.clock = options.clock ?? systemClock;
    this.newId = options.newId ?? randomId;
  }

  async create<T extends ItemType>(input: NewItem<T>): Promise<Item> {
    const id = this.newId();
    const now = nowTimestamp(this.clock);
    const payload = serialisePayload(input.type, input.payload, id);
    await this.driver.run(
      `INSERT INTO items (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        input.type,
        input.title,
        input.body ?? null,
        input.url ?? null,
        input.done ? 1 : 0,
        payload,
        now,
        now,
      ],
    );
    log.debug('item.created', { type: input.type, id });
    const created = await this.get(id);
    if (created === null) {
      throw new StorageError('item vanished immediately after insert', {
        operation: 'create',
        type: input.type,
        id,
      });
    }
    return created;
  }

  async get(id: string): Promise<Item | null> {
    const row = await queryOne<ItemRow>(
      this.driver,
      `SELECT ${COLUMNS} FROM items WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return row === null ? null : toItem(row);
  }

  async list(filter: ListItemsFilter = {}): Promise<Item[]> {
    const params: SqlValue[] = [];
    let sql = `SELECT ${COLUMNS} FROM items WHERE deleted_at IS NULL`;
    if (filter.type !== undefined) {
      sql += ' AND type = ?';
      params.push(filter.type);
    }
    sql += ' ORDER BY created_at DESC, id DESC';
    if (filter.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }
    const rows = await this.driver.query<ItemRow>(sql, params);
    return rows.map(toItem);
  }

  /** Soft-deleted rows, for the purge screen. The one read that ignores `deleted_at`. */
  async listDeleted(): Promise<Item[]> {
    const rows = await this.driver.query<ItemRow>(
      `SELECT ${COLUMNS} FROM items WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`,
    );
    return rows.map(toItem);
  }

  async update<T extends ItemType>(id: string, patch: ItemPatch<T>): Promise<Item> {
    const existing = await this.get(id);
    if (existing === null) {
      throw new StorageError('cannot update a missing or deleted item', {
        operation: 'update',
        id,
      });
    }
    const assignments: string[] = [];
    const params: SqlValue[] = [];
    if (patch.title !== undefined) {
      assignments.push('title = ?');
      params.push(patch.title);
    }
    if (patch.body !== undefined) {
      assignments.push('body = ?');
      params.push(patch.body);
    }
    if (patch.url !== undefined) {
      assignments.push('url = ?');
      params.push(patch.url);
    }
    if (patch.done !== undefined) {
      assignments.push('done = ?');
      params.push(patch.done ? 1 : 0);
    }
    if (patch.payload !== undefined) {
      assignments.push('payload = ?');
      params.push(serialisePayload(existing.type, patch.payload as never, id));
    }
    assignments.push('updated_at = ?');
    params.push(nowTimestamp(this.clock));
    params.push(id);
    await this.driver.run(`UPDATE items SET ${assignments.join(', ')} WHERE id = ?`, params);
    const updated = await this.get(id);
    if (updated === null) {
      throw new StorageError('item vanished during update', { operation: 'update', id });
    }
    return updated;
  }

  /** SPECS §4.1: a soft delete sets `deleted_at` and retains any attached file. */
  async softDelete(id: string): Promise<void> {
    const now = nowTimestamp(this.clock);
    await this.driver.run(
      'UPDATE items SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
    log.info('item.soft_deleted', { id });
  }

  async restore(id: string): Promise<void> {
    await this.driver.run('UPDATE items SET deleted_at = NULL, updated_at = ? WHERE id = ?', [
      nowTimestamp(this.clock),
      id,
    ]);
    log.info('item.restored', { id });
  }
}
