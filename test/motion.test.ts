import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { LIST_CATEGORIES } from '../src/ui/categories.ts';
import { slideKind } from '../src/ui/motion.ts';

/*
 * SPECS §2.2, Look and motion. The colours and the motion are CSS, which no test renders;
 * these check the two ways the stylesheets could break without anything looking wrong in
 * review — a category with no hue, and motion outside the reduced-motion guard.
 */

function stylesheet(name: string): string {
  const text = readFileSync(new URL(`../src/ui/${name}`, import.meta.url), 'utf8');
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('category colours', function colours() {
  const theme = stylesheet('theme.css');
  const tokenBlock = /:is\(([^)]*)\)\s*\{\s*--colour-gold:/.exec(theme)?.[1] ?? '';

  it('finds the block that redefines the gold tokens', function found() {
    assert.notEqual(tokenBlock, '', 'the :is(...) token block was not found in theme.css');
  });

  for (const id of LIST_CATEGORIES.filter((candidate) => candidate !== 'todo')) {
    it(`gives ${id} a hue, and lists it where the tokens are redefined`, function hue() {
      // Without both, the tokens under [data-cat] resolve to nothing, and so does every
      // colour on that category's screens.
      assert.match(theme, new RegExp(`\\[data-cat='${id}'\\]\\s*\\{\\s*--hue:\\s*\\d+;`));
      assert.ok(tokenBlock.includes(`[data-cat='${id}']`), `${id} is missing from :is(...)`);
    });
  }

  it('leaves To-do on the gold', function todo() {
    assert.ok(!tokenBlock.includes(`[data-cat='todo']`));
  });
});

describe('motion', function motion() {
  it('keeps every rule inside the reduced-motion guard', function guarded() {
    const css = stylesheet('motion.css').trim();
    const guard = '@media (prefers-reduced-motion: no-preference) {';
    assert.ok(css.startsWith(guard), 'motion.css must open with the reduced-motion guard');
    let depth = 0;
    for (let index = 0; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1;
      if (css[index] === '}') depth -= 1;
      // The guard's block closes only at the very end; anything after it is unguarded.
      if (depth === 0 && index > guard.length) {
        assert.equal(css.slice(index + 1).trim(), '', 'a rule sits outside the guard');
        return;
      }
    }
    assert.fail('the reduced-motion guard is never closed');
  });

  it('slides the way the finger went along the icon row', function slides() {
    assert.equal(slideKind('todo', 'note'), 'cat-next');
    assert.equal(slideKind('workouts', 'todo'), 'cat-prev');
  });

  it('cross-fades to a category outside the icon row, and for no change', function fades() {
    assert.equal(slideKind('todo', 'habit'), 'cat');
    assert.equal(slideKind('habit', 'note'), 'cat');
    assert.equal(slideKind('note', 'note'), 'cat');
  });
});
