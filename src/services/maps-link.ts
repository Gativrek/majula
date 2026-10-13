/**
 * Google Maps links, as shared or pasted into Majula (`docs/modules/places.md` 15–21).
 *
 * Pure. Shared text comes from another app and is untrusted input (CODESTYLE §9): only
 * links to Google Maps hosts are accepted, and nothing here opens anything.
 *
 * Short links (`maps.app.goo.gl/…`) carry no coordinates. Resolving them needs the
 * network, which the app does not have (ADR-003), so coordinates come from a link only
 * when the link itself contains them.
 */

import { parseCoordinates } from './coordinates.ts';

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface MapsShare {
  /** The listing's name, when the share names it. */
  name: string | null;
  url: string;
  coordinates: Coordinates | null;
}

/** Hosts whose links are Google Maps listings or map views. */
function isMapsUrl(url: URL): boolean {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl') return true;
  if (host === 'goo.gl') return url.pathname.startsWith('/maps');
  // maps.google.com, maps.google.com.br …
  if (/^maps\.google\.[a-z.]+$/.test(host)) return true;
  // google.com/maps, www.google.com.br/maps …
  return /^(www\.)?google\.[a-z.]+$/.test(host) && url.pathname.startsWith('/maps');
}

/** Whether a stored string is still a Google Maps link, for rendering it as one. */
export function isMapsLink(text: string): boolean {
  try {
    return isMapsUrl(new URL(text));
  } catch {
    return false;
  }
}

/** The first Google Maps link in a piece of text, or null. */
export function findMapsLink(text: string): string | null {
  for (const candidate of text.match(/https?:\/\/\S+/gi) ?? []) {
    // Shares sometimes wrap a link in punctuation.
    const trimmed = candidate.replace(/[)\]>.,;'"]+$/, '');
    if (isMapsLink(trimmed)) return trimmed;
  }
  return null;
}

/** Accept a pair only if it is a valid latitude and longitude, using the paste rules. */
function validPair(lat: string, lon: string): Coordinates | null {
  const parsed = parseCoordinates(`${lat}, ${lon}`);
  return parsed.ok ? { lat: parsed.lat, lon: parsed.lon } : null;
}

/**
 * Coordinates written into a long Maps link, or null.
 *
 * A listing link carries its own position as `!3d<lat>!4d<lon>`, and usually also the map
 * view's centre as `@<lat>,<lon>,<zoom>z`. The listing's own position is preferred: the
 * view's centre is wherever the map happened to be when the link was made.
 */
export function coordinatesFromMapsLink(link: string): Coordinates | null {
  const number = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const listing = new RegExp(`!3d${number}!4d${number}`).exec(link);
  if (listing !== null) return validPair(listing[1] ?? '', listing[2] ?? '');

  const view = new RegExp(`@${number},${number}`).exec(link);
  if (view !== null) return validPair(view[1] ?? '', view[2] ?? '');

  try {
    const params = new URL(link).searchParams;
    for (const key of ['q', 'query', 'll', 'destination']) {
      const value = params.get(key);
      const pair = value === null ? null : new RegExp(`^${number},\\s*${number}$`).exec(value);
      if (pair !== null) return validPair(pair[1] ?? '', pair[2] ?? '');
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Read what Google Maps shares: the listing's name on the first line, perhaps an address,
 * and the link. Android may also pass the name separately as the share's subject.
 *
 * @returns null when the text holds no Google Maps link, which the caller refuses.
 */
export function parseMapsShare(text: string, subject?: string): MapsShare | null {
  const url = findMapsLink(text);
  if (url === null) return null;

  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.replace(url, '').trim())
    .find((line) => line.length > 0 && !/^https?:\/\//i.test(line));
  const fromSubject = subject?.trim();
  const name =
    fromSubject !== undefined && fromSubject.length > 0 && findMapsLink(fromSubject) === null
      ? fromSubject
      : (firstLine ?? null);

  return { name, url, coordinates: coordinatesFromMapsLink(url) };
}
