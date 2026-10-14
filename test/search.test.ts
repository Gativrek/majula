import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ItemStore } from '../src/data/items.ts';
import { runMigrations } from '../src/data/migrations.ts';
import { MARK_END, MARK_START, searchHits, searchItems, toMatchQuery } from '../src/data/search.ts';
import { setTags, tagsForItems } from '../src/data/tags.ts';
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
  return {
    driver,
    store: new ItemStore(driver, {
      clock: () => new Date('2026-09-21T12:00:00.000Z'),
      newId: sequentialIds(),
    }),
  };
}

async function titlesFor(driver: Awaited<ReturnType<typeof freshStore>>['driver'], query: string) {
  return (await searchItems(driver, query)).map((item) => item.title).sort();
}

describe('match query building', function matchSuite() {
  it('returns null when there is nothing to search for', function empty() {
    assert.equal(toMatchQuery(''), null);
    assert.equal(toMatchQuery('   '), null);
  });

  it('quotes each token and makes it a prefix', function prefix() {
    assert.equal(toMatchQuery('gnss ins'), '"gnss"* "ins"*');
  });

  it('neutralises FTS5 syntax that would otherwise throw or mislead', function syntax() {
    // Unquoted, each of these is FTS5 operator syntax rather than text.
    assert.equal(toMatchQuery('NEAR'), '"NEAR"*');
    assert.equal(toMatchQuery('-milk'), '"-milk"*');
    assert.equal(toMatchQuery('say "hi"'), '"say"* """hi"""*');
  });
});

describe('global search', function searchSuite() {
  it('finds an item by a word in its body', async function byBody() {
    const { driver, store } = await freshStore();
    await store.create({
      type: 'note',
      title: 'Idea on the bus',
      body: 'cache the RRT tree across episodes',
    });
    assert.deepEqual(await titlesFor(driver, 'episodes'), ['Idea on the bus']);
    await driver.close();
  });

  it('finds an item by a prefix of a word', async function byPrefix() {
    const { driver, store } = await freshStore();
    await store.create({ type: 'contact', title: 'Ana Souza', body: 'works on UAV GNSS' });
    assert.deepEqual(await titlesFor(driver, 'gns'), ['Ana Souza']);
    await driver.close();
  });

  it('requires every token to match', async function allTokens() {
    const { driver, store } = await freshStore();
    await store.create({ type: 'note', title: 'GNSS receiver notes' });
    await store.create({ type: 'note', title: 'INS drift notes' });
    assert.deepEqual(await titlesFor(driver, 'notes'), ['GNSS receiver notes', 'INS drift notes']);
    assert.deepEqual(await titlesFor(driver, 'gnss notes'), ['GNSS receiver notes']);
    await driver.close();
  });

  it('searches across every type at once', async function allTypes() {
    const { driver, store } = await freshStore();
    await store.create({ type: 'note', title: 'olive oil idea' });
    await store.create({ type: 'grocery', title: 'Olive oil' });
    assert.equal((await searchItems(driver, 'olive')).length, 2);
    await driver.close();
  });

  it('excludes soft-deleted rows, and finds them again after restore', async function deleted() {
    const { driver, store } = await freshStore();
    const item = await store.create({ type: 'note', title: 'Findable' });

    assert.deepEqual(await titlesFor(driver, 'findable'), ['Findable']);
    await store.softDelete(item.id);
    assert.deepEqual(await titlesFor(driver, 'findable'), []);
    await store.restore(item.id);
    assert.deepEqual(
      await titlesFor(driver, 'findable'),
      ['Findable'],
      'SPECS §4.2: the index keeps the row; the query filters it',
    );
    await driver.close();
  });

  it('reflects an edited title immediately', async function edited() {
    const { driver, store } = await freshStore();
    const item = await store.create({ type: 'note', title: 'Before' });
    await store.update(item.id, { title: 'After' });
    assert.deepEqual(await titlesFor(driver, 'before'), []);
    assert.deepEqual(await titlesFor(driver, 'after'), ['After']);
    await driver.close();
  });

  it('indexes rows that existed before the FTS migration ran', async function rebuild() {
    const driver = openTestDatabase();
    // Stop at version 1: the schema Phase 1 shipped, with no index at all.
    await runMigrations(driver, 1);
    await driver.run(
      'INSERT INTO items (id, type, title, body, done, payload, created_at, updated_at) ' +
        "VALUES ('00000000-0000-4000-8000-000000000099', 'note', 'Captured in Phase 1', " +
        "'written before the index existed', 0, '{}', '2026-09-21T12:00:00.000Z', " +
        "'2026-09-21T12:00:00.000Z')",
    );

    await runMigrations(driver);

    assert.deepEqual(
      await titlesFor(driver, 'index'),
      ['Captured in Phase 1'],
      'the migration rebuilds the index, or every earlier row is invisible forever',
    );
    await driver.close();
  });

  it('does not search tags, which are a filter rather than text', async function tagsNotSearched() {
    const { driver, store } = await freshStore();
    const item = await store.create({ type: 'note', title: 'Untagged words' });
    await setTags(driver, item.id, ['pesquisa']);
    assert.deepEqual(await titlesFor(driver, 'pesquisa'), []);
    await driver.close();
  });

  it('returns nothing rather than everything for an empty query', async function emptyQuery() {
    const { driver, store } = await freshStore();
    await store.create({ type: 'note', title: 'Something' });
    assert.deepEqual(await searchItems(driver, '   '), []);
    await driver.close();
  });
});

describe('where a search matched', function hitsSuite() {
  const mark = (word: string) => `${MARK_START}${word}${MARK_END}`;

  it('marks the matched words in the title', async function title() {
    const { driver, store } = await freshStore();
    await store.create({ type: 'grocery', title: 'Coffee beans' });
    const [hit] = await searchHits(driver, 'bean');
    assert.equal(hit?.markedTitle, `Coffee ${mark('beans')}`);
    assert.equal(hit?.markedSnippet, null, 'no body, so no snippet');
    await driver.close();
  });

  it('gives a marked stretch of body when the match is there', async function body() {
    const { driver, store } = await freshStore();
    await store.create({
      type: 'note',
      title: 'Roaster near the market',
      body: 'Sells single-origin beans by the kilo on Saturdays.',
    });
    const [hit] = await searchHits(driver, 'beans');
    assert.equal(hit?.markedTitle, 'Roaster near the market');
    assert.ok(hit?.markedSnippet?.includes(mark('beans')));
    await driver.close();
  });

  it('gives no snippet when the body has no match', async function titleOnly() {
    const { driver, store } = await freshStore();
    await store.create({ type: 'note', title: 'Beans to buy', body: 'from the market' });
    const [hit] = await searchHits(driver, 'beans');
    assert.equal(hit?.markedSnippet, null);
    await driver.close();
  });
});

describe('tags for a list', function tagsForItemsSuite() {
  it('returns each item its own tags, sorted, and leaves untagged items out', async function many() {
    const { driver, store } = await freshStore();
    const a = await store.create({ type: 'todo', title: 'A' });
    const b = await store.create({ type: 'todo', title: 'B' });
    const c = await store.create({ type: 'todo', title: 'C' });
    await setTags(driver, a.id, ['work', 'errands']);
    await setTags(driver, b.id, ['home']);
    const tags = await tagsForItems(driver, [a.id, b.id, c.id]);
    assert.deepEqual(tags.get(a.id), ['errands', 'work']);
    assert.deepEqual(tags.get(b.id), ['home']);
    assert.equal(tags.has(c.id), false);
    assert.equal((await tagsForItems(driver, [])).size, 0);
    await driver.close();
  });
});
