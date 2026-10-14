import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIST_CATEGORIES, adjacentCategory } from '../src/ui/categories.ts';

describe('swiping between categories', function categorySwipeSuite() {
  it('moves to the next or previous icon in the row', function adjacent() {
    assert.equal(adjacentCategory('todo', 1), 'note');
    assert.equal(adjacentCategory('note', -1), 'todo');
  });

  it('stops at either end instead of wrapping round', function ends() {
    assert.equal(adjacentCategory(LIST_CATEGORIES[0] ?? 'todo', -1), null);
    assert.equal(
      adjacentCategory(LIST_CATEGORIES[LIST_CATEGORIES.length - 1] ?? 'workouts', 1),
      null,
    );
  });

  it('lands on the first icon from Habits, which is not in the row', function fromHabits() {
    assert.equal(adjacentCategory('habit', 1), LIST_CATEGORIES[0]);
    assert.equal(adjacentCategory('habit', -1), LIST_CATEGORIES[0]);
  });
});
