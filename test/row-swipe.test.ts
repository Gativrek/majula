import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { REVEAL_WIDTH, axisOf, dragOffset, settlesOpen } from '../src/ui/row-swipe.ts';

describe('swiping a row to delete', function rowSwipeSuite() {
  it('waits for a real move before deciding the axis', function tap() {
    assert.equal(axisOf(3, -2), null);
  });

  it('leaves a mostly vertical move to the scrolling list', function scroll() {
    assert.equal(axisOf(6, 20), 'vertical');
    assert.equal(axisOf(-20, 6), 'horizontal');
  });

  it('never slides right of rest or past the Delete button', function clamp() {
    assert.equal(dragOffset(40, false), 0);
    assert.equal(dragOffset(-500, false), -REVEAL_WIDTH);
    assert.equal(dragOffset(30, true), -REVEAL_WIDTH + 30);
  });

  it('opens past halfway and closes short of it', function settle() {
    assert.equal(settlesOpen(-REVEAL_WIDTH / 2 - 1, false), true);
    assert.equal(settlesOpen(-REVEAL_WIDTH / 2 + 1, false), false);
  });

  it('closes an open row dragged back to the right', function closeOpen() {
    assert.equal(settlesOpen(REVEAL_WIDTH, true), false);
    assert.equal(settlesOpen(10, true), true, 'a small nudge leaves it open');
  });
});
