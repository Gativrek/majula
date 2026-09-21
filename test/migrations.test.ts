import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import {
  MIGRATIONS,
  readSchemaVersion,
  runMigrations,
  TARGET_SCHEMA_VERSION,
} from '../src/data/migrations.ts';
import { setLogLevel } from '../src/lib/logger.ts';
import { openTestDatabase } from './support/driver-node.ts';

setLogLevel('error');

describe('migrations', function migrationsSuite() {
  const drivers = [] as ReturnType<typeof openTestDatabase>[];

  function freshDriver() {
    const driver = openTestDatabase();
    drivers.push(driver);
    return driver;
  }

  after(async function closeAll() {
    await Promise.all(drivers.map((driver) => driver.close()));
  });

  it('are numbered without gaps or duplicates', function numbering() {
    const versions = MIGRATIONS.map((migration) => migration.version);
    assert.deepEqual(
      versions,
      [...versions].sort((a, b) => a - b),
    );
    assert.equal(new Set(versions).size, versions.length);
    versions.forEach(function eachVersion(version, index) {
      assert.equal(version, index + 1, 'migration versions start at 1 and are contiguous');
    });
  });

  it('bring an empty database to the target version', async function fromEmpty() {
    const driver = freshDriver();
    assert.equal(await readSchemaVersion(driver), 0);
    assert.equal(await runMigrations(driver), TARGET_SCHEMA_VERSION);
    assert.equal(await readSchemaVersion(driver), TARGET_SCHEMA_VERSION);
  });

  it('create the tables SPECS §4.2 describes', async function schemaShape() {
    const driver = freshDriver();
    await runMigrations(driver);
    const tables = await driver.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const names = tables.map((row) => row.name);
    assert.ok(names.includes('items'));
    assert.ok(names.includes('tags'));
    assert.ok(names.includes('schema_version'));
  });

  it('are idempotent across repeated runs', async function rerun() {
    const driver = freshDriver();
    await runMigrations(driver);
    await runMigrations(driver);
    assert.equal(await readSchemaVersion(driver), TARGET_SCHEMA_VERSION);
  });

  it('keep schema_version to a single row', async function singleRow() {
    const driver = freshDriver();
    await runMigrations(driver);
    await assert.rejects(
      driver.run('INSERT INTO schema_version (id, version) VALUES (2, 9)'),
      'CHECK (id = 1) must reject a second row',
    );
  });

  it('refuse a database ahead of this build', async function aheadOfBinary() {
    const driver = freshDriver();
    await runMigrations(driver);
    await driver.run('UPDATE schema_version SET version = ? WHERE id = 1', [
      TARGET_SCHEMA_VERSION + 1,
    ]);
    await assert.rejects(runMigrations(driver), /ahead of this build/);
  });
});
