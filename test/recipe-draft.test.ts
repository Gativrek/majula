import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validatePayload } from '../src/data/payload.ts';
import { ValidationError } from '../src/lib/errors.ts';
import type { RecipeDraft } from '../src/services/recipe-draft.ts';
import {
  buildRecipe,
  draftFromRecipe,
  formatIngredient,
  parseQuantity,
} from '../src/services/recipe-draft.ts';

function draft(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return {
    title: 'Feijão tropeiro',
    servings: '4',
    ingredients: [{ qty: '500', unit: 'g', name: 'feijão' }],
    steps: ['Cozinhe o feijão.'],
    ...overrides,
  };
}

describe('quantity parsing', function quantitySuite() {
  it('reads a blank field as absent, not zero', function blank() {
    assert.equal(parseQuantity(''), undefined);
    assert.equal(parseQuantity('   '), undefined);
  });

  it('accepts either decimal separator', function separators() {
    assert.equal(parseQuantity('0.5'), 0.5);
    assert.equal(parseQuantity('0,5'), 0.5);
    assert.equal(parseQuantity('1,25'), 1.25);
  });

  it('refuses a value that means a different number in each convention', function ambiguous() {
    // Portuguese 1.000 is a thousand; read as a decimal it is one.
    assert.equal(parseQuantity('1.000'), 'ambiguous');
    assert.equal(parseQuantity('2,500'), 'ambiguous');
    assert.equal(parseQuantity('250.000'), 'ambiguous');
  });

  it('does not flag decimals that cannot be thousands', function unambiguous() {
    assert.equal(parseQuantity('0,125'), 0.125, 'grouping never starts with a zero');
    assert.equal(parseQuantity('1,5'), 1.5);
    assert.equal(parseQuantity('1000'), 1000);
    assert.equal(parseQuantity('1,0000'), 1);
  });

  it('refuses text that is not a number', function invalid() {
    assert.equal(parseQuantity('um pouco'), 'invalid');
    assert.equal(parseQuantity('1/2'), 'invalid');
  });
});

describe('building a recipe from the editor', function buildSuite() {
  it('builds a valid payload that the data layer accepts', function valid() {
    const result = buildRecipe(draft());
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.deepEqual(result.payload, {
      servings: 4,
      ingredients: [{ qty: 500, unit: 'g', name: 'feijão' }],
      steps: ['Cozinhe o feijão.'],
    });
    assert.doesNotThrow(() => validatePayload('recipe', result.payload));
  });

  it('keeps a name-only ingredient with no quantity or unit', function nameOnly() {
    const result = buildRecipe(
      draft({ ingredients: [{ qty: '', unit: '', name: 'sal a gosto' }] }),
    );
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.deepEqual(result.payload.ingredients, [{ name: 'sal a gosto' }]);
    assert.ok(
      !('qty' in (result.payload.ingredients[0] ?? {})),
      'absent stays absent; it is not stored as zero',
    );
  });

  it('drops a row left entirely blank', function blankRow() {
    const result = buildRecipe(
      draft({
        ingredients: [
          { qty: '500', unit: 'g', name: 'feijão' },
          { qty: '', unit: '', name: '' },
        ],
      }),
    );
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.payload.ingredients.length, 1);
  });

  it('refuses a row with a quantity but no name rather than dropping it', function noName() {
    const result = buildRecipe(draft({ ingredients: [{ qty: '200', unit: 'g', name: '' }] }));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.field, 'ingredient 1');
  });

  it('names the ingredient whose quantity is ambiguous', function ambiguousRow() {
    const result = buildRecipe(
      draft({
        ingredients: [
          { qty: '500', unit: 'g', name: 'feijão' },
          { qty: '1.000', unit: 'g', name: 'farinha' },
        ],
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.field, 'ingredient 2');
    assert.match(result.message, /1\.000/);
  });

  it('refuses a missing title', function noTitle() {
    const result = buildRecipe(draft({ title: '  ' }));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.field, 'title');
  });

  it('refuses servings that are missing, zero or not a number', function badServings() {
    for (const servings of ['', '0', '-2', 'muitas']) {
      const result = buildRecipe(draft({ servings }));
      assert.equal(result.ok, false, `servings "${servings}" must be refused`);
      if (result.ok) continue;
      assert.equal(result.field, 'servings');
    }
  });

  it('drops empty steps and keeps the order of the rest', function steps() {
    const result = buildRecipe(draft({ steps: ['Primeiro.', '   ', 'Segundo.', ''] }));
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.deepEqual(result.payload.steps, ['Primeiro.', 'Segundo.']);
  });

  it('keeps the text exactly as typed apart from surrounding whitespace', function verbatim() {
    const result = buildRecipe(
      draft({ ingredients: [{ qty: '', unit: 'colher (sopa)', name: 'Açúcar MASCAVO' }] }),
    );
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.deepEqual(result.payload.ingredients[0], {
      unit: 'colher (sopa)',
      name: 'Açúcar MASCAVO',
    });
  });

  it('round-trips through the editor unchanged', function roundTrip() {
    const payload = {
      servings: 4,
      ingredients: [{ qty: 0.5, unit: 'xícara', name: 'leite' }, { name: 'sal a gosto' }],
      steps: ['Misture.', 'Asse.'],
    };
    const result = buildRecipe(draftFromRecipe('Bolo', payload));
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.deepEqual(result.payload, payload);
  });
});

describe('recipe payload validation', function payloadSuite() {
  it('accepts an ingredient with a name and nothing else', function nameOnly() {
    assert.doesNotThrow(() =>
      validatePayload('recipe', { servings: 1, ingredients: [{ name: 'sal' }], steps: [] }),
    );
  });

  it('rejects an ingredient with no name', function noName() {
    assert.throws(
      () => validatePayload('recipe', { servings: 1, ingredients: [{ qty: 2 }], steps: [] }),
      ValidationError,
    );
  });

  it('rejects zero servings', function zeroServings() {
    assert.throws(
      () => validatePayload('recipe', { servings: 0, ingredients: [], steps: [] }),
      ValidationError,
    );
  });
});

describe('kitchen-mode ingredient line', function formatSuite() {
  it('shows quantity, unit and name in one line', function full() {
    assert.equal(formatIngredient({ qty: 500, unit: 'g', name: 'feijão' }), '500 g feijão');
  });

  it('shows only the name when there is no quantity or unit', function nameOnly() {
    assert.equal(formatIngredient({ name: 'sal a gosto' }), 'sal a gosto');
  });
});
