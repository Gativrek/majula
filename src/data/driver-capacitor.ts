/**
 * The device driver: `@capacitor-community/sqlite` (ADR-002).
 *
 * The plugin wraps every `execute`/`run` in its own transaction by default, which
 * conflicts with the explicit transactions this driver exposes. Every call therefore
 * passes `transaction = false` and this module owns the BEGIN/COMMIT itself.
 */

import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { StorageError } from '../lib/errors.ts';
import { log } from '../lib/logger.ts';
import type { SqlDriver, SqlValue } from './driver.ts';

const DATABASE_NAME = 'majula';

class CapacitorSqlDriver implements SqlDriver {
  private readonly db: SQLiteDBConnection;
  private depth = 0;

  constructor(db: SQLiteDBConnection) {
    this.db = db;
  }

  async executeScript(sql: string): Promise<void> {
    try {
      await this.db.execute(sql, false);
    } catch (cause) {
      throw new StorageError('executeScript failed', { operation: 'executeScript' }, { cause });
    }
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    try {
      await this.db.run(sql, [...params], false);
    } catch (cause) {
      throw new StorageError('run failed', { operation: 'run' }, { cause });
    }
  }

  async query<Row>(sql: string, params: readonly SqlValue[] = []): Promise<Row[]> {
    try {
      const result = await this.db.query(sql, [...params]);
      return (result.values ?? []) as Row[];
    } catch (cause) {
      throw new StorageError('query failed', { operation: 'query' }, { cause });
    }
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    // SQLite has no nested transactions; an inner call joins the outer one.
    if (this.depth > 0) {
      this.depth += 1;
      try {
        return await work();
      } finally {
        this.depth -= 1;
      }
    }
    await this.db.beginTransaction();
    this.depth = 1;
    try {
      const result = await work();
      await this.db.commitTransaction();
      return result;
    } catch (cause) {
      await this.db.rollbackTransaction();
      throw cause;
    } finally {
      this.depth = 0;
    }
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}

/**
 * Open the app's database on the device.
 *
 * @throws {StorageError} when the plugin is unavailable — which is what happens in a
 * desktop browser, where there is no native SQLite. That failure is loud on purpose:
 * acceptance is verified on a real device (SPECS §6), never in a browser.
 */
export async function openDeviceDatabase(): Promise<SqlDriver> {
  let db: SQLiteDBConnection;
  try {
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    const isConsistent = (await sqlite.checkConnectionsConsistency()).result === true;
    const exists = (await sqlite.isConnection(DATABASE_NAME, false)).result === true;
    db =
      isConsistent && exists
        ? await sqlite.retrieveConnection(DATABASE_NAME, false)
        : await sqlite.createConnection(DATABASE_NAME, false, 'no-encryption', 1, false);
    await db.open();
  } catch (cause) {
    throw new StorageError('could not open the SQLite database', { operation: 'open' }, { cause });
  }

  // SPECS §4.1: without this SQLite treats every REFERENCES clause as documentation.
  await db.execute('PRAGMA foreign_keys = ON;', false);
  log.info('db.opened', { name: DATABASE_NAME });

  return new CapacitorSqlDriver(db);
}
