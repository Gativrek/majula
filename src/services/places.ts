/**
 * What the UI may do with places (`docs/modules/places.md`).
 */

import type { AppContext } from './database.ts';

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

export async function clearPlaceCoordinates(context: AppContext, placeId: string): Promise<void> {
  await context.items.update<'place'>(placeId, { payload: {} });
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
