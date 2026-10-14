import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LOCK_DISTANCE, leftHold } from '../src/ui/row-hold.ts';

describe('holding a row to delete', function rowHoldSuite() {
  it('stays a hold through the small wobble of a still finger', function wobble() {
    assert.equal(leftHold(3, -2), false);
    assert.equal(leftHold(LOCK_DISTANCE - 1, 0), false);
  });

  it('stops being a hold once the finger scrolls or swipes', function moved() {
    assert.equal(leftHold(0, LOCK_DISTANCE), true);
    assert.equal(leftHold(-20, 4), true);
  });
});
