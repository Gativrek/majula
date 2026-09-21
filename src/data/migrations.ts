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

export const MIGRATIONS: readonly Migration[] = [MIGRATION_001];

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
 * Bring the database up to {@link TARGET_SCHEMA_VERSION}.
 *
 * Logs `from -> to` and the outcome on every run (CODESTYLE §6).
 *
 * @throws {InvariantError} when the database is ahead of this binary. That is not a
 * recoverable state: an older build cannot know what a newer migration did.
 */
export async function runMigrations(driver: SqlDriver): Promise<number> {
  const from = await readSchemaVersion(driver);

  if (from > TARGET_SCHEMA_VERSION) {
    log.error('migration.ahead_of_binary', { from, target: TARGET_SCHEMA_VERSION });
    throw new InvariantError(
      `database schema_version ${from} is ahead of this build (${TARGET_SCHEMA_VERSION})`,
    );
  }

  if (from === TARGET_SCHEMA_VERSION) {
    log.info('migration.up_to_date', { version: from });
    return from;
  }

  log.info('migration.start', { from, to: TARGET_SCHEMA_VERSION });

  for (const migration of MIGRATIONS) {
    if (migration.version <= from) continue;
    await driver.transaction(async function applyMigration() {
      await driver.executeScript(migration.sql);
      await writeSchemaVersion(driver, migration.version);
    });
    log.info('migration.applied', { version: migration.version, name: migration.name });
  }

  log.info('migration.done', { from, to: TARGET_SCHEMA_VERSION });
  return TARGET_SCHEMA_VERSION;
}
