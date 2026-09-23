/**
 * Coordinates for places (`docs/modules/places.md` criteria 7–10): reading a pasted pair,
 * showing one, and handing one to the maps app.
 *
 * Pure. Every refusal the spec lists — decimal commas, degrees-minutes-seconds, out of
 * range, longitude first — is a test here rather than a place filed somewhere wrong.
 */

export type ParsedCoordinates =
  | { ok: true; lat: number; lon: number }
  | {
      ok: false;
      reason: 'empty' | 'dms' | 'decimal_comma' | 'unrecognised' | 'out_of_range' | 'swapped';
      message: string;
    };

/** Two signed decimals separated by a comma, whitespace, or both. Decimal points only. */
const DECIMAL_PAIR = /^(-?\d{1,3}(?:\.\d+)?)\s*(?:,\s*|\s+)(-?\d{1,3}(?:\.\d+)?)$/;

/** Anything that reads as degrees, minutes and seconds, or as a compass direction. */
const DMS_MARKERS = /[°'"′″]|\d\s*[NSEWnsew]\b/;

/** A decimal comma: a digit, a comma, a digit, with no space between. */
const DECIMAL_COMMA = /\d,\d/;

const EXAMPLE = 'Paste them as "-12.3400, -56.0000".';

function refuse(reason: Exclude<ParsedCoordinates, { ok: true }>['reason'], message: string) {
  return { ok: false as const, reason, message };
}

function inLatitudeRange(value: number): boolean {
  return value >= -90 && value <= 90;
}

function inLongitudeRange(value: number): boolean {
  return value >= -180 && value <= 180;
}

/**
 * Read coordinates pasted from a maps app, or from a `geo:` link.
 *
 * Maps apps copy with decimal points whatever the phone's locale, so that is all this
 * accepts. With decimal commas, `-12,34, -56,0` has three commas and nothing says which
 * one separates the numbers.
 */
export function parseCoordinates(raw: string): ParsedCoordinates {
  let text = raw.trim().replace(/−/g, '-');
  if (text.length === 0) return refuse('empty', 'Nothing to set.');

  if (/^geo:/i.test(text)) {
    // geo:lat,lon;u=35?q=... — the pair is everything before the first parameter.
    text = text.slice(4).split(/[;?]/)[0] ?? '';
  }

  if (DMS_MARKERS.test(text)) {
    return refuse('dms', `Degrees, minutes and seconds are not accepted. ${EXAMPLE}`);
  }

  const match = DECIMAL_PAIR.exec(text);
  if (match === null) {
    if (DECIMAL_COMMA.test(text)) {
      return refuse(
        'decimal_comma',
        `Those use decimal commas, so it is unclear where one number ends. ${EXAMPLE}`,
      );
    }
    return refuse('unrecognised', `Those are not coordinates. ${EXAMPLE}`);
  }

  const lat = Number(match[1]);
  const lon = Number(match[2]);

  if (inLatitudeRange(lat) && inLongitudeRange(lon)) return { ok: true, lat, lon };

  if (inLatitudeRange(lon) && inLongitudeRange(lat)) {
    // Right more often than not, and silently wrong the rest of the time: a place filed
    // in the wrong hemisphere is found by nobody. Say so instead of swapping.
    return refuse(
      'swapped',
      'That looks like longitude first. Latitude comes first, between -90 and 90.',
    );
  }

  return refuse(
    'out_of_range',
    'Latitude must be between -90 and 90, and longitude between -180 and 180.',
  );
}

/** Five decimal places is about a metre: all a place needs, and short enough to read. */
export function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/**
 * A link the device's maps app opens (places.md criterion 10). The label in `q` is the
 * convention Google Maps reads to name the pin.
 */
export function geoLink(lat: number, lon: number, label: string): string {
  const pair = `${lat},${lon}`;
  return `geo:${pair}?q=${pair}(${encodeURIComponent(label)})`;
}
