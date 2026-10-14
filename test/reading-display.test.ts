import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { continueLabel, openableUrl, shownUrl } from '../src/ui/reading-display.ts';

describe('a reading entry on screen', function readingDisplaySuite() {
  it('offers only web addresses as links', function links() {
    assert.equal(
      openableUrl('https://arxiv.org/abs/1706.03762'),
      'https://arxiv.org/abs/1706.03762',
    );
    assert.equal(openableUrl('javascript:alert(1)'), null);
    assert.equal(openableUrl('not a url'), null);
    assert.equal(openableUrl(null), null);
  });

  it('shows an address without its scheme or trailing slash', function shown() {
    assert.equal(shownUrl('https://example.com/paper/'), 'example.com/paper');
  });

  it('opens a PDF from the start, or continues where reading stopped', function label() {
    assert.equal(continueLabel(undefined), 'Open PDF');
    assert.equal(continueLabel(1), 'Open PDF');
    assert.equal(continueLabel(6), 'Continue on page 6');
  });
});
