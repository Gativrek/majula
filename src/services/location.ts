/**
 * The one read of the device's position (`docs/modules/places.md` criteria 3–6), made
 * only when the owner taps **Here**.
 *
 * Uses the WebView's own `navigator.geolocation`. Capacitor's WebView client relays its
 * permission prompt to Android, so there is no location plugin (DECISIONS.md, 2026-09-23).
 *
 * Coordinates are never logged: they record where the owner has been (CODESTYLE §6).
 */

import { log } from '../lib/logger.ts';

/** The slice of the Geolocation API this uses, so tests can supply their own. */
export interface GeolocationLike {
  getCurrentPosition(
    success: (position: {
      coords: { latitude: number; longitude: number; accuracy: number };
    }) => void,
    failure: (error: { code: number }) => void,
    options: { enableHighAccuracy: boolean; timeout: number; maximumAge: number },
  ): void;
}

export type Fix =
  | { ok: true; lat: number; lon: number; accuracyMetres: number }
  | { ok: false; reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout'; message: string };

/**
 * Long enough for a GPS fix with no network assist — the airplane-mode case the spec
 * promises — which can take tens of seconds from cold.
 */
const FIX_TIMEOUT_MS = 45_000;

/** A position from the last minute is still where the owner is standing. */
const MAXIMUM_AGE_MS = 60_000;

/** The Geolocation API's error codes. */
const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

/** GPS reports far more digits than it is accurate to. Six places is about ten centimetres. */
function rounded(degrees: number): number {
  return Math.round(degrees * 1e6) / 1e6;
}

function failure(reason: Exclude<Fix, { ok: true }>['reason']): Fix {
  const messages = {
    unsupported: 'This device cannot report its location.',
    denied: 'Location permission was refused. Nothing was changed.',
    unavailable: 'The location could not be found. Nothing was changed.',
    timeout: 'No location fix in time. Without signal a first fix is slow; try again outside.',
  } as const;
  log.info('place.location', { outcome: reason });
  return { ok: false, reason, message: messages[reason] };
}

/**
 * Where the phone is now.
 *
 * @param geolocation the platform API; tests pass a stand-in.
 */
export async function locateHere(
  geolocation: GeolocationLike | undefined = globalThis.navigator?.geolocation,
): Promise<Fix> {
  if (geolocation === undefined) return failure('unsupported');

  return new Promise<Fix>(function waitForFix(resolve) {
    geolocation.getCurrentPosition(
      function onFix(position) {
        const { latitude, longitude, accuracy } = position.coords;
        const accuracyMetres = Math.round(accuracy);
        log.info('place.location', { outcome: 'fixed', accuracy_m: accuracyMetres });
        resolve({ ok: true, lat: rounded(latitude), lon: rounded(longitude), accuracyMetres });
      },
      function onFailure(error) {
        if (error.code === PERMISSION_DENIED) resolve(failure('denied'));
        else if (error.code === TIMEOUT) resolve(failure('timeout'));
        else resolve(failure('unavailable'));
      },
      { enableHighAccuracy: true, timeout: FIX_TIMEOUT_MS, maximumAge: MAXIMUM_AGE_MS },
    );
  });
}
