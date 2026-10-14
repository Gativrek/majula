import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { commitDraft, finalTags, parseTags, suggestTags } from '../src/ui/tag-entry.ts';

describe('typing tags in quick capture', function tagEntrySuite() {
  it('splits on spaces and commas and drops a leading #', function parse() {
    assert.deepEqual(parseTags('#work, home  ideas'), ['work', 'home', 'ideas']);
  });

  it('leaves a tag being typed in the draft', function typing() {
    assert.deepEqual(commitDraft([], 'errand'), { tags: [], draft: 'errand' });
  });

  it('turns a tag into a pill once a space or comma follows it', function finished() {
    assert.deepEqual(commitDraft(['work'], 'errands, ho'), {
      tags: ['work', 'errands'],
      draft: 'ho',
    });
  });

  it('never makes the same pill twice, and keeps case', function duplicates() {
    assert.deepEqual(commitDraft(['work'], 'work GNSS gnss '), {
      tags: ['work', 'GNSS', 'gnss'],
      draft: '',
    });
  });

  it('saves the pills and the unfinished draft together', function save() {
    assert.deepEqual(finalTags(['work'], 'home'), ['work', 'home']);
    assert.deepEqual(finalTags(['work'], ' '), ['work']);
  });

  it('suggests the most-used tags not already chosen', function suggest() {
    const known = [
      { tag: 'ideas', count: 2 },
      { tag: 'work', count: 9 },
      { tag: 'kitchen', count: 6 },
      { tag: 'home', count: 6 },
    ];
    assert.deepEqual(suggestTags(known, ['work'], 2), ['home', 'kitchen']);
  });
});
