import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MARK_END, MARK_START } from '../src/services/items.ts';
import { splitMarks } from '../src/ui/marks.ts';

describe('marked search text', function marksSuite() {
  it('splits text into plain and matched runs', function runs() {
    assert.deepEqual(splitMarks(`Coffee ${MARK_START}beans${MARK_END} and more`), [
      { text: 'Coffee ', marked: false },
      { text: 'beans', marked: true },
      { text: ' and more', marked: false },
    ]);
  });

  it('leaves unmarked text as one plain run', function plain() {
    assert.deepEqual(splitMarks('Feijoada'), [{ text: 'Feijoada', marked: false }]);
  });

  it('marks to the end when a mark is never closed, and drops empty runs', function unclosed() {
    assert.deepEqual(splitMarks(`${MARK_START}${MARK_END}a ${MARK_START}bean`), [
      { text: 'a ', marked: false },
      { text: 'bean', marked: true },
    ]);
  });
});
