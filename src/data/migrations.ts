/**
 * Numbered, forward-only migrations (SPECS §6, CODESTYLE §10).
 *
 * A shipped migration is never edited. A mistake in one is fixed by the next.
 */

import { InvariantError } from '../lib/errors.ts';
import { log } from '../lib/logger.ts';
import type { SqlDriver } from './driver.ts';
import { queryOne } from './driver.ts';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

/**
 * SPECS §4.2. `items_fts` and its triggers are deliberately absent: they depend on
 * GATE V1 (FTS5 availability on the device) and ship in Phase 2.
 */
const MIGRATION_001: Migration = {
  version: 1,
  name: 'create-items-tags-schema-version',
  sql: `
    CREATE TABLE items (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT,
      url         TEXT,
      done        INTEGER NOT NULL DEFAULT 0,
      payload     TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      deleted_at  TEXT
    );

    CREATE TABLE tags (
      item_id  TEXT NOT NULL REFERENCES items(id),
      tag      TEXT NOT NULL,
      PRIMARY KEY (item_id, tag)
    );

    CREATE INDEX idx_items_type ON items(type) WHERE deleted_at IS NULL;
    CREATE INDEX idx_tags_tag ON tags(tag);
  `,
};

/**
 * Global search (SPECS §2.2, §4.2). GATE V1 closed on 2026-09-21: FTS5 is present in the
 * plugin's bundled SQLite on the target device, so this is the only search path.
 *
 * The triggers ship in the same migration as the table they keep in sync (CODESTYLE §10),
 * and none of them is conditional on `deleted_at`. A soft delete is an `UPDATE`, so the
 * update trigger re-indexes the row and it stays in the index on purpose; search filters
 * deleted rows at query time instead. The alternative — deleting from the index inside
 * the update trigger — needs an undelete path that would be exercised too rarely to stay
 * correct (§4.2).
 *
 * The final `rebuild` populates the index from the rows Phase 1 already captured. Without
 * it, everything written before this migration would be invisible to search forever.
 */
const MIGRATION_002: Migration = {
  version: 2,
  name: 'create-items-fts',
  sql: `
    CREATE VIRTUAL TABLE items_fts USING fts5(
      title, body, content='items', content_rowid='rowid'
    );

    CREATE TRIGGER items_fts_after_insert AFTER INSERT ON items BEGIN
      INSERT INTO items_fts (rowid, title, body) VALUES (new.rowid, new.title, new.body);
    END;

    CREATE TRIGGER items_fts_after_delete AFTER DELETE ON items BEGIN
      INSERT INTO items_fts (items_fts, rowid, title, body)
        VALUES ('delete', old.rowid, old.title, old.body);
    END;

    CREATE TRIGGER items_fts_after_update AFTER UPDATE ON items BEGIN
      INSERT INTO items_fts (items_fts, rowid, title, body)
        VALUES ('delete', old.rowid, old.title, old.body);
      INSERT INTO items_fts (rowid, title, body) VALUES (new.rowid, new.title, new.body);
    END;

    INSERT INTO items_fts (items_fts) VALUES ('rebuild');
  `,
};

export const MIGRATIONS: readonly Migration[] = [MIGRATION_001, MIGRATION_002];

export const TARGET_SCHEMA_VERSION = MIGRATIONS.reduce(function highestVersion(highest, migration) {
  return Math.max(highest, migration.version);
}, 0);

const SCHEMA_VERSION_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_version (
    id       INTEGER PRIMARY KEY CHECK (id = 1),
    version  INTEGER NOT NULL
  );
`;

export async function readSchemaVersion(driver: SqlDriver): Promise<number> {
  await driver.executeScript(SCHEMA_VERSION_TABLE);
  const row = await queryOne<{ version: number }>(driver, 'SELECT version FROM schema_version');
  return row?.version ?? 0;
}

async function writeSchemaVersion(driver: SqlDriver, version: number): Promise<void> {
  await driver.run(
    'INSERT INTO schema_version (id, version) VALUES (1, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET version = excluded.version',
    [version],
  );
}

/**
 * Bring the database up to `upTo`, which defaults to {@link TARGET_SCHEMA_VERSION}.
 *
 * `upTo` exists for the import path, which has to rebuild the schema at the version the
 * export was written under before it can put those rows back (see {@link resetSchema}).
 * Nothing else passes it.
 *
 * Logs `from -> to` and the outcome on every run (CODESTYLE §6).
 *
 * @throws {InvariantError} when the database is ahead of this binary. That is not a
 * recoverable state: an older build cannot know what a newer migration did.
 */
export async function runMigrations(driver: SqlDriver, upTo?: number): Promise<number> {
  const target = upTo ?? TARGET_SCHEMA_VERSION;
  const from = await readSchemaVersion(driver);

  if (from > TARGET_SCHEMA_VERSION) {
    log.error('migration.ahead_of_binary', { from, target: TARGET_SCHEMA_VERSION });
    throw new InvariantError(
      `database schema_version ${from} is ahead of this build (${TARGET_SCHEMA_VERSION})`,
    );
  }

  if (from >= target) {
    log.info('migration.up_to_date', { version: from });
    return from;
  }

  log.info('migration.start', { from, to: target });

  for (const migration of MIGRATIONS) {
    if (migration.version <= from || migration.version > target) continue;
    await driver.transaction(async function applyMigration() {
      await driver.executeScript(migration.sql);
      await writeSchemaVersion(driver, migration.version);
    });
    log.info('migration.applied', { version: migration.version, name: migration.name });
  }

  log.info('migration.done', { from, to: target });
  return target;
}

/**
 * Drop every object this schema owns, leaving an empty database at version 0.
 *
 * Only the import path calls this. SPECS §5 says an import replaces the database rather
 * than merging into it, and replacing it properly means rebuilding the schema at the
 * export's own version and migrating those rows forward — not pouring old rows into a
 * newer schema and hoping the shapes still line up. Re-running a migration over a schema
 * that already has its objects would fail outright on the second `CREATE`.
 *
 * The names come from SQLite's own catalogue, not from the file being imported, so this
 * does not breach the rule against putting data into SQL (CODESTYLE §10).
 */
export async function resetSchema(driver: SqlDriver): Promise<void> {
  const triggers = await driver.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'trigger'",
  );
  for (const trigger of triggers) {
    await driver.executeScript(`DROP TRIGGER IF EXISTS "${trigger.name}";`);
  }

  // Virtual tables go before ordinary ones: dropping an FTS5 table also removes the
  // shadow tables that would otherwise be listed here and fail on their own DROP.
  const tables = await driver.query<{ name: string; sql: string | null }>(
    "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const isVirtual = (row: { sql: string | null }): boolean =>
    row.sql !== null && /CREATE\s+VIRTUAL\s+TABLE/i.test(row.sql);

  for (const table of [...tables.filter(isVirtual), ...tables.filter((row) => !isVirtual(row))]) {
    await driver.executeScript(`DROP TABLE IF EXISTS "${table.name}";`);
  }

  log.info('schema.reset', { triggers: triggers.length, tables: tables.length });
}
