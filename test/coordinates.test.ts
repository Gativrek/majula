import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCoordinates, geoLink, parseCoordinates } from '../src/services/coordinates.ts';
import type { GeolocationLike } from '../src/services/location.ts';
import { locateHere } from '../src/services/location.ts';
import { setLogLevel } from '../src/lib/logger.ts';

setLogLevel('error');

function reasonOf(raw: string): string {
  const parsed = parseCoordinates(raw);
  return parsed.ok ? 'ok' : parsed.reason;
}

describe('pasted coordinates (places.md criteria 7–8)', function pasteSuite() {
  it('reads the pair a maps app copies', function mapsApp() {
    assert.deepEqual(parseCoordinates('-12.3400, -56.0000'), { ok: true, lat: -12.34, lon: -56 });
  });

  it('accepts a comma with no space, or whitespace alone', function separators() {
    assert.deepEqual(parseCoordinates('-12.34,-56.0'), { ok: true, lat: -12.34, lon: -56 });
    assert.deepEqual(parseCoordinates('  -12.34   -56.0  '), { ok: true, lat: -12.34, lon: -56 });
  });

  it('reads a geo: link, ignoring its parameters', function geoUri() {
    assert.deepEqual(parseCoordinates('geo:-12.34,-56.0;u=35?q=cafe'), {
      ok: true,
      lat: -12.34,
      lon: -56,
    });
  });

  it('accepts the typographic minus sign some apps use', function unicodeMinus() {
    assert.deepEqual(parseCoordinates('−12.34, −56.0'), {
      ok: true,
      lat: -12.34,
      lon: -56,
    });
  });

  it('refuses decimal commas, where the separator is ambiguous', function decimalComma() {
    assert.equal(reasonOf('-12,34, -56,0'), 'decimal_comma');
    assert.equal(reasonOf('-12,34 -56,0'), 'decimal_comma');
  });

  it('refuses degrees, minutes and seconds', function dms() {
    assert.equal(reasonOf(`12°20'24"S 56°0'0"W`), 'dms');
    assert.equal(reasonOf('12.34 S, 56.0 W'), 'dms');
  });

  it('refuses a pair that only works longitude first, rather than swapping it', function swapped() {
    assert.equal(reasonOf('-120.5, 45.2'), 'swapped');
  });

  it('refuses a pair out of range either way round', function outOfRange() {
    assert.equal(reasonOf('100, 200'), 'out_of_range');
  });

  it('refuses things that are not coordinates at all', function nonsense() {
    assert.equal(reasonOf(''), 'empty');
    assert.equal(reasonOf('Rua X, 120'), 'unrecognised');
    assert.equal(reasonOf('https://maps.app.goo.gl/abc123'), 'unrecognised');
  });
});

describe('showing and handing off coordinates', function outputSuite() {
  it('formats to about a metre', function format() {
    assert.equal(formatCoordinates(-12.34, -56), '-12.34000, -56.00000');
  });

  it('builds a geo: link with the name as the pin label', function link() {
    assert.equal(
      geoLink(-12.34, -56, 'Café on Rua X'),
      'geo:-12.34,-56?q=-12.34,-56(Caf%C3%A9%20on%20Rua%20X)',
    );
  });
});

/** A stand-in for the platform API, answering with whatever the test hands it. */
function device(
  answer:
    { fix: { latitude: number; longitude: number; accuracy: number } } | { errorCode: number },
): GeolocationLike {
  return {
    getCurrentPosition(success, failure) {
      if ('fix' in answer) success({ coords: answer.fix });
      else failure({ code: answer.errorCode });
    },
  };
}

describe('locating here (places.md criteria 3–6)', function locateSuite() {
  it('returns the fix, rounded, with its accuracy', async function fixed() {
    const fix = await locateHere(
      device({ fix: { latitude: -12.3400001234, longitude: -56.0000005678, accuracy: 12.4 } }),
    );
    assert.deepEqual(fix, { ok: true, lat: -12.34, lon: -56.000001, accuracyMetres: 12 });
  });

  it('says so when permission is refused', async function denied() {
    const fix = await locateHere(device({ errorCode: 1 }));
    assert.equal(fix.ok ? 'ok' : fix.reason, 'denied');
  });

  it('says so when no fix arrives in time', async function timeout() {
    const fix = await locateHere(device({ errorCode: 3 }));
    assert.equal(fix.ok ? 'ok' : fix.reason, 'timeout');
  });

  it('says so when the device has no location at all', async function unsupported() {
    const fix = await locateHere(undefined);
    assert.equal(fix.ok ? 'ok' : fix.reason, 'unsupported');
  });
});
