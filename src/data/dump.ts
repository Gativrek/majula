/**
 * Reading every row out of the database and putting every row back in (SPECS §5).
 *
 * This is the half of export/import that touches SQL. The filesystem half lives in
 * the service layer (CODESTYLE §4).
 */

import { StorageError, ValidationError } from '../lib/errors.ts';
import { log } from '../lib/logger.ts';
import type { SqlDriver, SqlValue } from './driver.ts';
import type { TableColumns } from './tables.ts';
import { insertionOrder } from './tables.ts';

export type RawRow = Record<string, SqlValue>;
export type TableDump = Record<string, RawRow[]>;

function quotedColumns(columns: readonly string[]): string {
  // Safe because these come from the registry in tables.ts, never from data.
  return columns.map((column) => `"${column}"`).join(', ');
}

/** Read every row of every registered table, deleted rows included. */
export async function dumpTables(driver: SqlDriver, columns: TableColumns): Promise<TableDump> {
  const dump: TableDump = {};
  for (const [table, tableColumns] of Object.entries(columns)) {
    const rows = await driver.query<RawRow>(
      `SELECT ${quotedColumns(tableColumns)} FROM "${table}"`,
    );
    dump[table] = rows;
    log.debug('dump.table', { table, rows: rows.length });
  }
  return dump;
}

function coerceValue(value: unknown, table: string, column: string): SqlValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  throw new ValidationError(`unsupported value in ${table}.${column}`, {
    subject: 'import.row',
  });
}

function rowValues(row: unknown, table: string, tableColumns: readonly string[]): SqlValue[] {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    throw new ValidationError(`${table}: expected an array of row objects`, {
      subject: 'import.table',
    });
  }
  const record = row as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!tableColumns.includes(key)) {
      // An unknown column means the file was written by something this build does
      // not understand. Importing it would silently drop data.
      throw new ValidationError(`${table}: unexpected column "${key}"`, {
        subject: 'import.table',
      });
    }
  }
  return tableColumns.map((column) => coerceValue(record[column], table, column));
}

/**
 * Replace the contents of every registered table with `dump`.
 *
 * SPECS §5: import replaces the database, it never merges. The whole restore runs in
 * one transaction, so a rejected file leaves the existing data untouched.
 *
 * @throws {ValidationError} when a row does not match the registered columns.
 */
export async function restoreTables(
  driver: SqlDriver,
  columns: TableColumns,
  dump: Record<string, unknown>,
): Promise<number> {
  const order = insertionOrder(columns);
  let restored = 0;

  await driver.transaction(async function replaceAllTables() {
    for (const table of [...order].reverse()) {
      await driver.run(`DELETE FROM "${table}"`);
    }
    for (const table of order) {
      const tableColumns = columns[table];
      if (tableColumns === undefined) {
        throw new StorageError('table missing from registry', { operation: 'restoreTables' });
      }
      const rows = dump[table];
      if (rows === undefined) {
        log.info('import.table_absent', { table });
        continue;
      }
      if (!Array.isArray(rows)) {
        throw new ValidationError(`${table}: expected an array`, { subject: 'import.table' });
      }
      const placeholders = tableColumns.map(() => '?').join(', ');
      const sql = `INSERT INTO "${table}" (${quotedColumns(tableColumns)}) VALUES (${placeholders})`;
      for (const row of rows) {
        await driver.run(sql, rowValues(row, table, tableColumns));
      }
      restored += rows.length;
      log.info('import.table_restored', { table, rows: rows.length });
    }
  });

  return restored;
}
