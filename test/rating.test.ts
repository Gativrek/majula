import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ratingLabel, starFills, tapStar } from '../src/ui/rating.ts';

describe('recipe rating as stars', function ratingSuite() {
  it('fills whole stars, then a half, then empties', function fills() {
    assert.deepEqual(starFills(7), ['full', 'full', 'full', 'half', 'empty']);
    assert.deepEqual(starFills(0), ['empty', 'empty', 'empty', 'empty', 'empty']);
    assert.deepEqual(starFills(10), ['full', 'full', 'full', 'full', 'full']);
    assert.deepEqual(starFills(1), ['half', 'empty', 'empty', 'empty', 'empty']);
  });

  it('fills up to the star tapped, from no rating or any other', function fillTo() {
    assert.equal(tapStar(null, 4), 8);
    assert.equal(tapStar(3, 2), 4);
    assert.equal(tapStar(10, 1), 2);
  });

  it('halves the star tapped again, and fills it on a third tap', function half() {
    assert.equal(tapStar(8, 4), 7);
    assert.equal(tapStar(7, 4), 8);
  });

  it('names the rating in stars, halves included', function label() {
    assert.equal(ratingLabel(7), '3½ stars');
    assert.equal(ratingLabel(2), '1 star');
    assert.equal(ratingLabel(1), '½ star');
    assert.equal(ratingLabel(0), '0 stars');
  });
});
