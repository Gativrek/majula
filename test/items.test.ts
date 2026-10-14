import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ItemStore } from '../src/data/items.ts';
import { runMigrations } from '../src/data/migrations.ts';
import { countDeleted, purgeDeleted } from '../src/data/purge.ts';
import { listTags, setTags, tagsForItem } from '../src/data/tags.ts';
import { setLogLevel } from '../src/lib/logger.ts';
import { openTestDatabase } from './support/driver-node.ts';

setLogLevel('error');

function sequentialIds(): () => string {
  let next = 0;
  return function nextId() {
    next += 1;
    return `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`;
  };
}

async function freshStore() {
  const driver = openTestDatabase();
  await runMigrations(driver);
  const clock = () => new Date('2026-09-21T12:00:00.000Z');
  return { driver, store: new ItemStore(driver, { clock, newId: sequentialIds() }) };
}

describe('item store', function itemSuite() {
  it('creates and reads back a note', async function create() {
    const { driver, store } = await freshStore();
    const created = await store.create({ type: 'note', title: 'Idea on the bus' });
    const read = await store.get(created.id);
    assert.equal(read?.title, 'Idea on the bus');
    assert.equal(read?.type, 'note');
    assert.equal(read?.done, false);
    assert.equal(read?.deletedAt, null);
    await driver.close();
  });

  it('lists any of several types for a category that spans them', async function types() {
    const { driver, store } = await freshStore();
    await store.create({ type: 'exercise', title: 'Bench press' });
    await store.create({ type: 'note', title: 'Not a workout' });
    await store.create({ type: 'routine', title: 'Upper A', payload: { exercises: [] } });
    const titles = (await store.list({ types: ['routine', 'exercise'] })).map((item) => item.title);
    assert.deepEqual(titles.sort(), ['Bench press', 'Upper A']);
    assert.equal((await store.list({ types: [] })).length, 3, 'an empty list filters nothing');
    await driver.close();
  });

  it('hides soft-deleted rows from every ordinary read', async function softDelete() {
    const { driver, store } = await freshStore();
    const item = await store.create({ type: 'todo', title: 'Renew bus card' });
    await store.softDelete(item.id);

    assert.equal(await store.get(item.id), null);
    assert.equal((await store.list()).length, 0);
    assert.equal((await store.listDeleted()).length, 1);
    await driver.close();
  });

  it('restores a soft-deleted row', async function restore() {
    const { driver, store } = await freshStore();
    const item = await store.create({ type: 'note', title: 'Recoverable' });
    await store.softDelete(item.id);
    await store.restore(item.id);
    assert.equal((await store.get(item.id))?.title, 'Recoverable');
    await driver.close();
  });

  it('refuses to update a deleted row rather than resurrecting it', async function updateDeleted() {
    const { driver, store } = await freshStore();
    const item = await store.create({ type: 'todo', title: 'Gone' });
    await store.softDelete(item.id);
    await assert.rejects(store.update(item.id, { done: true }), /missing or deleted/);
    await driver.close();
  });

  it('toggles done without touching the other columns', async function toggleDone() {
    const { driver, store } = await freshStore();
    const item = await store.create({ type: 'grocery', title: 'Olive oil' });
    const updated = await store.update(item.id, { done: true });
    assert.equal(updated.done, true);
    assert.equal(updated.title, 'Olive oil');
    await driver.close();
  });

  it('stores tags verbatim and lists only live ones', async function tags() {
    const { driver, store } = await freshStore();
    const item = await store.create({ type: 'note', title: 'Tagged' });
    await setTags(driver, item.id, ['Pesquisa', 'gnss', 'gnss', ' ']);
    assert.deepEqual(await tagsForItem(driver, item.id), ['Pesquisa', 'gnss']);

    await store.softDelete(item.id);
    assert.deepEqual(await listTags(driver), []);
    await driver.close();
  });

  it('purges only deleted rows, and their tags with them', async function purge() {
    const { driver, store } = await freshStore();
    const kept = await store.create({ type: 'note', title: 'Kept' });
    const doomed = await store.create({ type: 'note', title: 'Doomed' });
    await setTags(driver, doomed.id, ['temp']);
    await store.softDelete(doomed.id);

    assert.equal(await countDeleted(driver), 1);
    const result = await purgeDeleted(driver);
    assert.equal(result.purgedRows, 1);
    assert.deepEqual(result.orphanedFiles, []);

    assert.equal((await store.list()).length, 1);
    assert.equal((await store.get(kept.id))?.title, 'Kept');
    assert.deepEqual(await tagsForItem(driver, doomed.id), []);
    await driver.close();
  });

  it('reports the PDF of a purged reading entry so the caller can unlink it', async function purgeFiles() {
    const { driver, store } = await freshStore();
    const reading = await store.create({
      type: 'reading',
      title: 'Tightly coupled GNSS/INS review',
      payload: { pdf_path: 'pdfs/abc.pdf', page_count: 14, last_page: 6 },
    });
    await store.softDelete(reading.id);

    const result = await purgeDeleted(driver);
    assert.deepEqual(result.orphanedFiles, ['pdfs/abc.pdf']);
    await driver.close();
  });

  it('enforces the tags foreign key', async function foreignKey() {
    const { driver } = await freshStore();
    await assert.rejects(
      driver.run('INSERT INTO tags (item_id, tag) VALUES (?, ?)', ['no-such-item', 'x']),
      'PRAGMA foreign_keys = ON must make REFERENCES real',
    );
    await driver.close();
  });
});
