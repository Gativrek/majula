import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ItemStore } from '../src/data/items.ts';
import { runMigrations } from '../src/data/migrations.ts';
import { setLogLevel } from '../src/lib/logger.ts';
import type { AppContext } from '../src/services/database.ts';
import { parseMapsShare } from '../src/services/maps-link.ts';
import {
  addPlaceFromShare,
  clearPlaceCoordinates,
  setPlaceCoordinates,
  setPlaceLink,
} from '../src/services/places.ts';
import { openTestDatabase } from './support/driver-node.ts';
import { createMemoryFileStore } from './support/files-memory.ts';

setLogLevel('error');

async function freshContext(): Promise<AppContext> {
  const driver = openTestDatabase();
  const schemaVersion = await runMigrations(driver);
  return { driver, items: new ItemStore(driver), files: createMemoryFileStore(), schemaVersion };
}

const SHARED = 'Restaurante Fogão Mineiro\nRua X, 120 - Centro\nhttps://maps.app.goo.gl/AbC123';

describe('a place shared from Google Maps', function shareSuite() {
  it('becomes a place named after the listing, with its link', async function creates() {
    const context = await freshContext();
    const share = parseMapsShare(SHARED);
    assert.ok(share !== null);
    if (share === null) return;

    const { place, existed } = await addPlaceFromShare(context, share);
    assert.equal(existed, false);
    assert.equal(place.title, 'Restaurante Fogão Mineiro');
    assert.equal(place.url, 'https://maps.app.goo.gl/AbC123');
    assert.deepEqual(
      place.payload,
      {},
      'a short link carries no coordinates, so none are invented',
    );
    await context.driver.close();
  });

  it('opens the existing place when the same listing is shared again', async function dedupes() {
    const context = await freshContext();
    const share = parseMapsShare(SHARED);
    if (share === null) return;

    const first = await addPlaceFromShare(context, share);
    const again = await addPlaceFromShare(context, share);
    assert.equal(again.existed, true);
    assert.equal(again.place.id, first.place.id);
    assert.equal((await context.items.list({ type: 'place' })).length, 1);
    await context.driver.close();
  });

  it('makes a new place if the earlier one was deleted', async function deletedIsNotLive() {
    const context = await freshContext();
    const share = parseMapsShare(SHARED);
    if (share === null) return;

    const first = await addPlaceFromShare(context, share);
    await context.items.softDelete(first.place.id);
    const again = await addPlaceFromShare(context, share);
    assert.equal(again.existed, false);
    await context.driver.close();
  });

  it('takes coordinates from a long link', async function longLink() {
    const context = await freshContext();
    const share = parseMapsShare(
      'Café\nhttps://www.google.com/maps/place/Caf%C3%A9/data=!4m2!3m1!8m2!3d-12.3401!4d-56.0002',
    );
    if (share === null) return;
    const { place } = await addPlaceFromShare(context, share);
    assert.deepEqual(place.payload, { lat: -12.3401, lon: -56.0002 });
    await context.driver.close();
  });
});

describe('a Maps link pasted onto a place', function pasteSuite() {
  it('keeps the link and leaves coordinates alone when the link has none', async function short() {
    const context = await freshContext();
    const place = await context.items.create({ type: 'place', title: 'Café' });
    await setPlaceCoordinates(context, place.id, { lat: -12.34, lon: -56 });

    await setPlaceLink(context, place.id, { url: 'https://maps.app.goo.gl/Z', coordinates: null });
    const after = await context.items.get(place.id);
    assert.equal(after?.url, 'https://maps.app.goo.gl/Z');
    assert.deepEqual(after?.payload, { lat: -12.34, lon: -56 });
    await context.driver.close();
  });

  it('clears the link along with the coordinates', async function clears() {
    const context = await freshContext();
    const place = await context.items.create({ type: 'place', title: 'Café' });
    await setPlaceLink(context, place.id, {
      url: 'https://maps.app.goo.gl/Z',
      coordinates: { lat: -12.34, lon: -56 },
    });

    await clearPlaceCoordinates(context, place.id);
    const after = await context.items.get(place.id);
    assert.equal(after?.url, null);
    assert.deepEqual(after?.payload, {});
    await context.driver.close();
  });
});
