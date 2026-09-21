/**
 * The test driver: `node:sqlite`, a platform API rather than a dependency.
 *
 * It exists so migrations, the item store and the export round trip can be tested
 * without an Android device. It is not shipped and is not a third backend: device
 * acceptance still runs on the phone (SPECS §6).
 */

import { DatabaseSync } from 'node:sqlite';
import type { SqlDriver, SqlValue } from '../../src/data/driver.ts';

class NodeSqlDriver implements SqlDriver {
  private readonly db: DatabaseSync;
  private depth = 0;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  async executeScript(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    this.db.prepare(sql).run(...params);
  }

  async query<Row>(sql: string, params: readonly SqlValue[] = []): Promise<Row[]> {
    return this.db.prepare(sql).all(...params) as Row[];
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.depth > 0) {
      this.depth += 1;
      try {
        return await work();
      } finally {
        this.depth -= 1;
      }
    }
    this.db.exec('BEGIN');
    this.depth = 1;
    try {
      const result = await work();
      this.db.exec('COMMIT');
      return result;
    } catch (cause) {
      this.db.exec('ROLLBACK');
      throw cause;
    } finally {
      this.depth = 0;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export function openTestDatabase(): SqlDriver {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  return new NodeSqlDriver(db);
}
