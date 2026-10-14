import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Gesture } from '../src/ui/swipe.ts';
import { swipeTurn } from '../src/ui/swipe.ts';

/** A quick, clean swipe on a page that fits the width, unless told otherwise. */
function gesture(overrides: Partial<Gesture>): Gesture {
  return {
    dx: 0,
    dy: 0,
    durationMs: 200,
    couldScrollLeft: false,
    couldScrollRight: false,
    ...overrides,
  };
}

describe('swiping between pages (reading-queue.md 11a)', function swipeSuite() {
  it('turns forward on a swipe left and back on a swipe right', function directions() {
    assert.equal(swipeTurn(gesture({ dx: -120 })), 'next');
    assert.equal(swipeTurn(gesture({ dx: 120 })), 'previous');
  });

  it('ignores a tap or a short wobble', function short() {
    assert.equal(swipeTurn(gesture({ dx: -20 })), null);
    assert.equal(swipeTurn(gesture({ dx: 59 })), null);
  });

  it('never turns while scrolling down a page', function vertical() {
    assert.equal(swipeTurn(gesture({ dx: -90, dy: 300 })), null);
    assert.equal(swipeTurn(gesture({ dx: -90, dy: 60 })), null, 'not sideways enough');
    assert.equal(swipeTurn(gesture({ dx: -130, dy: 60 })), 'next', 'sideways enough');
  });

  it('ignores a slow drag, which is panning', function slow() {
    assert.equal(swipeTurn(gesture({ dx: -200, durationMs: 1200 })), null);
  });

  it('pans a zoomed page instead of turning while it can still scroll', function zoomed() {
    assert.equal(swipeTurn(gesture({ dx: -150, couldScrollRight: true })), null);
    assert.equal(swipeTurn(gesture({ dx: 150, couldScrollLeft: true })), null);
  });

  it('turns from a zoomed page once it is already at that edge', function atEdge() {
    // At the right edge, still able to scroll left: a swipe left turns forward.
    assert.equal(swipeTurn(gesture({ dx: -150, couldScrollLeft: true })), 'next');
    assert.equal(swipeTurn(gesture({ dx: 150, couldScrollRight: true })), 'previous');
  });
});
