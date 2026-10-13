import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  coordinatesFromMapsLink,
  findMapsLink,
  isMapsLink,
  parseMapsShare,
} from '../src/services/maps-link.ts';

describe('recognising Google Maps links (places.md 21)', function hostSuite() {
  it('accepts the hosts Google Maps shares and links from', function accepted() {
    for (const link of [
      'https://maps.app.goo.gl/AbC123xyz',
      'https://goo.gl/maps/AbC123',
      'https://maps.google.com/?q=-12.34,-56.0',
      'https://maps.google.com.br/maps?q=cafe',
      'https://www.google.com/maps/place/Caf%C3%A9/@-12.34,-56.0,17z',
      'https://www.google.com.br/maps/place/Caf%C3%A9',
    ]) {
      assert.equal(isMapsLink(link), true, link);
    }
  });

  it('refuses lookalikes and other sites', function refused() {
    for (const link of [
      'https://maps.app.goo.gl.evil.example/AbC',
      'https://evilgoogle.com/maps/place/x',
      'https://www.google.com/search?q=cafe',
      'https://goo.gl/AbC123',
      'https://www.openstreetmap.org/#map=17/-12.34/-56.0',
      'javascript:alert(1)',
      'geo:-12.34,-56.0',
      'not a link',
    ]) {
      assert.equal(isMapsLink(link), false, link);
    }
  });

  it('finds the Maps link among other text and punctuation', function find() {
    assert.equal(
      findMapsLink('Look (https://maps.app.goo.gl/AbC123).'),
      'https://maps.app.goo.gl/AbC123',
    );
    assert.equal(
      findMapsLink('https://example.com/a then https://maps.app.goo.gl/Z'),
      'https://maps.app.goo.gl/Z',
    );
    assert.equal(findMapsLink('Just some words https://example.com'), null);
  });
});

describe('coordinates inside a link (places.md 19)', function coordinatesSuite() {
  it('prefers the listing’s own position over the map view’s centre', function listingFirst() {
    const link =
      'https://www.google.com/maps/place/Caf%C3%A9/@-12.3000,-56.1000,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-12.3401!4d-56.0002';
    assert.deepEqual(coordinatesFromMapsLink(link), { lat: -12.3401, lon: -56.0002 });
  });

  it('falls back to the view centre, then to a query', function fallbacks() {
    assert.deepEqual(coordinatesFromMapsLink('https://www.google.com/maps/@-12.34,-56.0,15z'), {
      lat: -12.34,
      lon: -56,
    });
    assert.deepEqual(coordinatesFromMapsLink('https://maps.google.com/?q=-12.34,-56.0'), {
      lat: -12.34,
      lon: -56,
    });
  });

  it('finds nothing in a short link, rather than guessing', function shortLink() {
    assert.equal(coordinatesFromMapsLink('https://maps.app.goo.gl/AbC123xyz'), null);
  });

  it('ignores coordinates that are out of range', function outOfRange() {
    assert.equal(coordinatesFromMapsLink('https://www.google.com/maps/@120.0,56.0,15z'), null);
  });
});

describe('reading a share from Google Maps (places.md 15)', function shareSuite() {
  it('takes the name from the first line and keeps the link', function nameAndAddress() {
    assert.deepEqual(
      parseMapsShare(
        'Restaurante Fogão Mineiro\nRua X, 120 - Centro, São Paulo - SP\nhttps://maps.app.goo.gl/AbC123',
      ),
      {
        name: 'Restaurante Fogão Mineiro',
        url: 'https://maps.app.goo.gl/AbC123',
        coordinates: null,
      },
    );
  });

  it('takes the name from the share subject when Android passes one', function subject() {
    const share = parseMapsShare('https://maps.app.goo.gl/AbC123', 'Café on Rua X');
    assert.equal(share?.name, 'Café on Rua X');
  });

  it('keeps a link that comes with no name at all', function linkOnly() {
    assert.deepEqual(parseMapsShare('https://maps.app.goo.gl/AbC123'), {
      name: null,
      url: 'https://maps.app.goo.gl/AbC123',
      coordinates: null,
    });
  });

  it('refuses a share with no Google Maps link (places.md 17)', function refused() {
    assert.equal(parseMapsShare('Remember to buy olive oil'), null);
    assert.equal(parseMapsShare('An article https://example.com/post'), null);
  });
});
