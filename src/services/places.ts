/**
 * What the UI may do with places (`docs/modules/places.md`).
 */

import type { ItemOfType } from '../data/types.ts';
import { InvariantError } from '../lib/errors.ts';
import { log } from '../lib/logger.ts';
import type { AppContext } from './database.ts';
import type { Coordinates, MapsShare } from './maps-link.ts';

export type PlaceResult = { ok: true } | { ok: false; message: string };

/** Store a coordinate pair. The data layer refuses a pair out of range (SPECS §4.3). */
export async function setPlaceCoordinates(
  context: AppContext,
  placeId: string,
  coordinates: { lat: number; lon: number },
): Promise<void> {
  await context.items.update<'place'>(placeId, {
    payload: { lat: coordinates.lat, lon: coordinates.lon },
  });
}

/**
 * Forget where a place is: its coordinates and any Google Maps link. Clearing one and not
 * the other would leave Open in maps pointing somewhere the owner just cleared.
 */
export async function clearPlaceCoordinates(context: AppContext, placeId: string): Promise<void> {
  await context.items.update<'place'>(placeId, { payload: {}, url: null });
}

/** The name is the title and the note is the body. A blank note clears it. */
export async function savePlaceDetails(
  context: AppContext,
  placeId: string,
  details: { name: string; note: string },
): Promise<PlaceResult> {
  const name = details.name.trim();
  if (name.length === 0) return { ok: false, message: 'A place needs a name.' };
  const note = details.note.trim();
  await context.items.update<'place'>(placeId, {
    title: name,
    body: note.length === 0 ? null : note,
  });
  return { ok: true };
}

/**
 * Keep a Google Maps link on a place, and the coordinates it carries if it carries any
 * (places.md 18–19). A short link carries none, so existing coordinates are left alone.
 */
export async function setPlaceLink(
  context: AppContext,
  placeId: string,
  link: { url: string; coordinates: Coordinates | null },
): Promise<void> {
  await context.items.update<'place'>(placeId, {
    url: link.url,
    ...(link.coordinates === null ? {} : { payload: link.coordinates }),
  });
}

/** Shares with no name of their own still need a title; the owner can rename it. */
const UNNAMED_SHARE = 'Place from Google Maps';

/**
 * A place shared from Google Maps (places.md 15–16). Sharing a listing already kept as a
 * live place opens that place rather than making a second one.
 */
export async function addPlaceFromShare(
  context: AppContext,
  share: MapsShare,
): Promise<{ place: ItemOfType<'place'>; existed: boolean }> {
  const places = await context.items.list({ type: 'place' });
  const existing = places.find((item) => item.url === share.url);
  if (existing?.type === 'place') {
    log.info('place.share_existing', { id: existing.id });
    return { place: existing, existed: true };
  }

  const created = await context.items.create({
    type: 'place',
    title: share.name ?? UNNAMED_SHARE,
    url: share.url,
    payload: share.coordinates ?? {},
  });
  if (created.type !== 'place') throw new InvariantError(`created ${created.type}, expected place`);
  log.info('place.share_created', { id: created.id, has_coordinates: share.coordinates !== null });
  return { place: created, existed: false };
}
