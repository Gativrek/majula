import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ItemStore } from '../src/data/items.ts';
import { runMigrations } from '../src/data/migrations.ts';
import { searchItems } from '../src/data/search.ts';
import { setLogLevel } from '../src/lib/logger.ts';
import type { AppContext } from '../src/services/database.ts';
import { joinNote, saveNoteText, splitNote } from '../src/services/notes.ts';
import { openTestDatabase } from './support/driver-node.ts';
import { createMemoryFileStore } from './support/files-memory.ts';

setLogLevel('error');

describe('a note as one piece of text', function notesSuite() {
  it('keeps a one-line note as a title with no body', function oneLine() {
    assert.deepEqual(splitNote('  Idea on the bus  '), { title: 'Idea on the bus', body: null });
  });

  it('takes the first line as the title and the rest as the body', function lines() {
    assert.deepEqual(splitNote('Trip\ncheck the bus times\n\n  pack the charger'), {
      title: 'Trip',
      body: 'check the bus times\n\n  pack the charger',
    });
  });

  it('skips blank lines between the title and the body, and trims only the ends', function gaps() {
    assert.deepEqual(splitNote('\n\nTrip   \n\n\nbody line\n\n'), {
      title: 'Trip',
      body: 'body line',
    });
  });

  it('reads an empty note as an empty title', function empty() {
    assert.deepEqual(splitNote('  \n \n'), { title: '', body: null });
  });

  it('joins back to the text it was typed as', function roundTrip() {
    const text = 'Trip\ncheck the bus times\n\n  pack the charger';
    const { title, body } = splitNote(text);
    assert.equal(joinNote(title, body), text);
    assert.equal(joinNote('Alone', null), 'Alone');
  });
});

describe('saving an edited note', function saveSuite() {
  async function freshNote() {
    const driver = openTestDatabase();
    const schemaVersion = await runMigrations(driver);
    const items = new ItemStore(driver);
    const context: AppContext = { driver, items, files: createMemoryFileStore(), schemaVersion };
    const note = await items.create({ type: 'note', title: 'Trip' });
    return { context, note };
  }

  it('stores the first line as title and the rest as body, and search finds the body', async function save() {
    const { context, note } = await freshNote();
    const result = await saveNoteText(context, note.id, 'Trip to Ouro Preto\npack the charger');
    assert.deepEqual(result, { ok: true });
    const saved = await context.items.get(note.id);
    assert.equal(saved?.title, 'Trip to Ouro Preto');
    assert.equal(saved?.body, 'pack the charger');
    assert.deepEqual(
      (await searchItems(context.driver, 'charger')).map((item) => item.id),
      [note.id],
    );
    await context.driver.close();
  });

  it('refuses an edit that leaves no text, and changes nothing', async function empty() {
    const { context, note } = await freshNote();
    const result = await saveNoteText(context, note.id, '  \n ');
    assert.equal(result.ok, false);
    assert.equal((await context.items.get(note.id))?.title, 'Trip');
    await context.driver.close();
  });
});
