import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ItemStore } from '../src/data/items.ts';
import { runMigrations, TARGET_SCHEMA_VERSION } from '../src/data/migrations.ts';
import { setTags } from '../src/data/tags.ts';
import {
  exportDatabase,
  importDatabase,
  parseEnvelope,
  EXPORT_FORMAT,
} from '../src/services/backup.ts';
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

async function freshDatabase(idPrefix = 1) {
  const driver = openTestDatabase();
  await runMigrations(driver);
  const store = new ItemStore(driver, {
    clock: () => new Date('2026-09-21T12:00:00.000Z'),
    newId: sequentialIds(idPrefix),
  });
  return { driver, store };
}

describe('export and import', function backupSuite() {
  it('writes the container GATE E1 chose: a JSON file beside a pdfs directory', async function container() {
    const { driver, store } = await freshDatabase();
    const files = createMemoryFileStore();
    await store.create({ type: 'note', title: 'Anything' });

    const result = await exportDatabase(driver, files);
    assert.equal(result.path, EXPORT_JSON);
    assert.equal(result.schemaVersion, TARGET_SCHEMA_VERSION);
    assert.equal(result.pdfsIncluded, true);
    assert.ok(await files.exists('export', `${EXPORT_DIRECTORY}/pdfs`));
    await driver.close();
  });

  it('survives a full round trip through a wiped device', async function roundTrip() {
    const source = await freshDatabase(1);
    const files = createMemoryFileStore();

    const note = await source.store.create({ type: 'note', title: 'Idea: RRT reuse' });
    await setTags(source.driver, note.id, ['pesquisa']);
    const todo = await source.store.create({ type: 'todo', title: 'Renew bus card' });
    await source.store.update(todo.id, { done: true });
    const doomed = await source.store.create({ type: 'note', title: 'Soft deleted' });
    await source.store.softDelete(doomed.id);

    await exportDatabase(source.driver, files);
    await source.driver.close();

    // A fresh install: new database, same export directory.
    const restored = await freshDatabase(2);
    const result = await importDatabase(restored.driver, files);

    assert.equal(result.fromSchemaVersion, TARGET_SCHEMA_VERSION);
    assert.equal(result.toSchemaVersion, TARGET_SCHEMA_VERSION);

    const live = await restored.store.list();
    assert.deepEqual(
      live.map((item) => item.title).sort(),
      ['Idea: RRT reuse', 'Renew bus card'],
      'live rows come back',
    );
    assert.equal(live.find((item) => item.type === 'todo')?.done, true, 'done flags survive');
    assert.equal(
      (await restored.store.listDeleted()).length,
      1,
      'a soft-deleted row is still recoverable after a restore',
    );

    const tags = await restored.driver.query<{ tag: string }>('SELECT tag FROM tags');
    assert.deepEqual(
      tags.map((row) => row.tag),
      ['pesquisa'],
    );
    await restored.driver.close();
  });

  it('replaces rather than merges', async function replaceNotMerge() {
    const source = await freshDatabase(1);
    const files = createMemoryFileStore();
    await source.store.create({ type: 'note', title: 'From the export' });
    await exportDatabase(source.driver, files);
    await source.driver.close();

    const target = await freshDatabase(2);
    await target.store.create({ type: 'note', title: 'Already on this phone' });
    await importDatabase(target.driver, files);

    const titles = (await target.store.list()).map((item) => item.title);
    assert.deepEqual(titles, ['From the export'], 'SPECS §5: import replaces, never merges');
    await target.driver.close();
  });

  it('omits PDFs when the exclude flag is set, and says so in the envelope', async function dataOnly() {
    const { driver, store } = await freshDatabase();
    const files = createMemoryFileStore();
    files.put('private', 'pdfs/abc.pdf', 'pretend-pdf');
    await store.create({ type: 'note', title: 'Anything' });

    const result = await exportDatabase(driver, files, { includePdfs: false });
    assert.equal(result.pdfCount, 0);
    assert.ok(!files.paths('export').includes(`${EXPORT_DIRECTORY}/pdfs/abc.pdf`));

    const envelope = parseEnvelope(await files.readText('export', EXPORT_JSON));
    assert.equal(envelope.pdfs_included, false);
    await driver.close();
  });

  it('carries attached PDFs by default and restores them on import', async function withPdfs() {
    const source = await freshDatabase(1);
    const files = createMemoryFileStore();
    files.put('private', 'pdfs/abc.pdf', 'pretend-pdf');
    await source.store.create({
      type: 'reading',
      title: 'Tightly coupled GNSS/INS review',
      payload: { pdf_path: 'pdfs/abc.pdf', page_count: 14, last_page: 6 },
    });

    const exported = await exportDatabase(source.driver, files);
    assert.equal(exported.pdfCount, 1);
    await source.driver.close();

    // ADR-004: the app's copy is often the only copy, so wipe it before importing.
    await files.deleteFile('private', 'pdfs/abc.pdf');

    const restored = await freshDatabase(2);
    const result = await importDatabase(restored.driver, files);
    assert.equal(result.restoredPdfs, 1);
    assert.equal(await files.readText('private', 'pdfs/abc.pdf'), 'pretend-pdf');

    const reading = (await restored.store.list())[0];
    assert.equal(reading?.type, 'reading');
    assert.equal(reading?.type === 'reading' ? reading.payload.last_page : null, 6);
    await restored.driver.close();
  });

  it('refuses an export from a newer build', async function refuseNewer() {
    const { driver, store } = await freshDatabase();
    const files = createMemoryFileStore();
    await store.create({ type: 'note', title: 'Anything' });
    await exportDatabase(driver, files);

    const envelope = JSON.parse(await files.readText('export', EXPORT_JSON)) as Record<
      string,
      unknown
    >;
    envelope.schema_version = TARGET_SCHEMA_VERSION + 1;
    await files.writeText('export', EXPORT_JSON, JSON.stringify(envelope));

    await assert.rejects(importDatabase(driver, files), /newer than this build/);
    await driver.close();
  });

  it('leaves the database untouched when the file is rejected', async function atomicFailure() {
    const { driver, store } = await freshDatabase();
    const files = createMemoryFileStore();
    await store.create({ type: 'note', title: 'Still here' });

    await files.writeText(
      'export',
      EXPORT_JSON,
      JSON.stringify({
        format: EXPORT_FORMAT,
        schema_version: TARGET_SCHEMA_VERSION,
        tables: { items: [{ id: 'x', not_a_column: 1 }] },
      }),
    );

    await assert.rejects(importDatabase(driver, files), /unexpected column/);
    assert.equal((await store.list()).length, 1, 'a rejected import rolls back');
    await driver.close();
  });

  it('rejects a file that is not one of ours', async function notOurs() {
    const { driver } = await freshDatabase();
    const files = createMemoryFileStore();
    await files.writeText('export', EXPORT_JSON, JSON.stringify({ hello: 'world' }));
    await assert.rejects(importDatabase(driver, files), /not a majula-export file/);
    await driver.close();
  });
});
