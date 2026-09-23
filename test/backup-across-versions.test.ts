import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ItemStore } from '../src/data/items.ts';
import { runMigrations, TARGET_SCHEMA_VERSION } from '../src/data/migrations.ts';
import { stateFor } from '../src/data/habits.ts';
import { searchItems } from '../src/data/search.ts';
import { setTags } from '../src/data/tags.ts';
import { exportDatabase, importDatabase } from '../src/services/backup.ts';
import { EXPORT_DIRECTORY, EXPORT_FILE_NAME } from '../src/services/files.ts';
import { setLogLevel } from '../src/lib/logger.ts';
import { openTestDatabase } from './support/driver-node.ts';
import { createMemoryFileStore } from './support/files-memory.ts';

setLogLevel('error');

const EXPORT_JSON = `${EXPORT_DIRECTORY}/${EXPORT_FILE_NAME}`;

function sequentialIds(prefix: number): () => string {
  let next = 0;
  return function nextId() {
    next += 1;
    return `00000000-0000-4000-8000-${String(prefix)}${String(next).padStart(11, '0')}`;
  };
}

function storeFor(driver: ReturnType<typeof openTestDatabase>, prefix: number) {
  return new ItemStore(driver, {
    clock: () => new Date('2026-09-21T12:00:00.000Z'),
    newId: sequentialIds(prefix),
  });
}

/**
 * SPECS §6 and ADR-003: the round trip is re-verified after every schema change, and
 * migration 002 is one. These are the cases the FTS migration introduced.
 */
describe('export and import across schema versions', function crossVersionSuite() {
  it('round-trips at the current version with search still working', async function current() {
    const source = openTestDatabase();
    await runMigrations(source);
    const sourceStore = storeFor(source, 1);
    const files = createMemoryFileStore();

    await sourceStore.create({ type: 'note', title: 'Idea', body: 'cache the RRT tree' });
    const exported = await exportDatabase(source, files);
    assert.equal(exported.schemaVersion, TARGET_SCHEMA_VERSION);
    await source.close();

    const target = openTestDatabase();
    await runMigrations(target);
    await importDatabase(target, files);

    const found = await searchItems(target, 'RRT');
    assert.deepEqual(
      found.map((item) => item.title),
      ['Idea'],
      'the triggers must reindex rows as the restore inserts them',
    );
    await target.close();
  });

  it('does not export the index, which is derived from the rows', async function noIndex() {
    const driver = openTestDatabase();
    await runMigrations(driver);
    await storeFor(driver, 1).create({ type: 'note', title: 'Anything' });
    const files = createMemoryFileStore();
    await exportDatabase(driver, files);

    const envelope = JSON.parse(await files.readText('export', EXPORT_JSON)) as {
      tables: Record<string, unknown>;
    };
    assert.deepEqual(
      Object.keys(envelope.tables).sort(),
      ['habit_checks', 'items', 'tags'],
      'facts travel in the export; the derived index does not',
    );
    await driver.close();
  });

  it('migrates a Phase 1 export forward into the current schema', async function older() {
    // A database that never saw migration 002, exported as it was.
    const old = openTestDatabase();
    await runMigrations(old, 1);
    const oldStore = storeFor(old, 1);
    const note = await oldStore.create({
      type: 'note',
      title: 'Captured in Phase 1',
      body: 'written before the index existed',
    });
    await setTags(old, note.id, ['pesquisa']);
    await oldStore.create({ type: 'todo', title: 'Renew bus card', done: true });

    const files = createMemoryFileStore();
    const exported = await exportDatabase(old, files);
    assert.equal(exported.schemaVersion, 1, 'the export records the version it was written at');
    await old.close();

    // The phone it lands on is on the current build.
    const target = openTestDatabase();
    await runMigrations(target);
    const result = await importDatabase(target, files);

    assert.equal(result.fromSchemaVersion, 1);
    assert.equal(result.toSchemaVersion, TARGET_SCHEMA_VERSION);
    assert.equal(result.restoredRows, 3, 'two items and one tag');

    const restored = await storeFor(target, 2).list();
    assert.deepEqual(restored.map((item) => item.title).sort(), [
      'Captured in Phase 1',
      'Renew bus card',
    ]);
    assert.equal(restored.find((item) => item.type === 'todo')?.done, true);

    const found = await searchItems(target, 'index');
    assert.deepEqual(
      found.map((item) => item.title),
      ['Captured in Phase 1'],
      'rows from before the index existed must be searchable after the import migrates them',
    );
    await target.close();
  });

  it('leaves the database intact when an older export is malformed', async function refused() {
    const target = openTestDatabase();
    await runMigrations(target);
    const store = storeFor(target, 1);
    await store.create({ type: 'note', title: 'Still here' });

    const files = createMemoryFileStore();
    await files.writeText(
      'export',
      EXPORT_JSON,
      JSON.stringify({
        format: 'majula-export',
        schema_version: 1,
        tables: { items: [{ id: 'x', not_a_column: 1 }] },
      }),
    );

    await assert.rejects(importDatabase(target, files), /unexpected column/);
    assert.deepEqual(
      (await store.list()).map((item) => item.title),
      ['Still here'],
      'the file is validated before the schema is torn down',
    );
    assert.deepEqual(
      (await searchItems(target, 'still')).map((item) => item.title),
      ['Still here'],
      'and the index survives with it',
    );
    await target.close();
  });
});

/** ROADMAP Phase 3: `habit_checks` is a new table in the export payload. */
describe('export and import with habit check-ins', function habitBackupSuite() {
  it('carries check-ins and restores the same streak', async function roundTrip() {
    const clock = () => new Date('2026-09-21T09:00:00');
    const source = openTestDatabase();
    await runMigrations(source);
    const habit = await storeFor(source, 1).create({ type: 'habit', title: 'Stretch' });
    for (const date of ['2026-09-19', '2026-09-20', '2026-09-21']) {
      await source.run('INSERT INTO habit_checks (habit_id, date) VALUES (?, ?)', [habit.id, date]);
    }

    const files = createMemoryFileStore();
    await exportDatabase(source, files);
    await source.close();

    const target = openTestDatabase();
    await runMigrations(target);
    await importDatabase(target, files);

    assert.equal((await stateFor(target, habit.id, clock)).streak, 3);
    await target.close();
  });

  it('migrates a Phase 2 export forward into the habit schema', async function fromVersion2() {
    const old = openTestDatabase();
    await runMigrations(old, 2);
    await storeFor(old, 1).create({ type: 'note', title: 'Before habits existed' });

    const files = createMemoryFileStore();
    const exported = await exportDatabase(old, files);
    assert.equal(exported.schemaVersion, 2);
    await old.close();

    const target = openTestDatabase();
    await runMigrations(target);
    const result = await importDatabase(target, files);

    assert.equal(result.fromSchemaVersion, 2);
    assert.equal(result.toSchemaVersion, TARGET_SCHEMA_VERSION);
    assert.deepEqual(
      (await storeFor(target, 2).list()).map((item) => item.title),
      ['Before habits existed'],
    );
    const checks = await target.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM habit_checks',
    );
    assert.equal(checks[0]?.count, 0, 'a table the export predates restores empty, not missing');
    await target.close();
  });
});

/** SPECS §4.3 amended 2026-09-23: absent quantities must survive a backup as absent. */
describe('export and import with recipes', function recipeBackupSuite() {
  it('restores every ingredient and step, with absent quantities still absent', async function recipe() {
    const payload = {
      servings: 4,
      ingredients: [{ qty: 500, unit: 'g', name: 'feijão' }, { name: 'sal a gosto' }],
      steps: ['Cozinhe o feijão.', 'Tempere.'],
    };
    const source = openTestDatabase();
    await runMigrations(source);
    const created = await storeFor(source, 1).create({
      type: 'recipe',
      title: 'Feijão tropeiro',
      payload,
    });

    const files = createMemoryFileStore();
    await exportDatabase(source, files);
    await source.close();

    const target = openTestDatabase();
    await runMigrations(target);
    await importDatabase(target, files);

    const restored = await storeFor(target, 2).get(created.id);
    assert.equal(restored?.type, 'recipe');
    if (restored?.type !== 'recipe') return;
    assert.deepEqual(restored.payload, payload);
    assert.ok(
      !('qty' in (restored.payload.ingredients[1] ?? {})),
      'a missing quantity must not come back as zero',
    );
    await target.close();
  });
});
