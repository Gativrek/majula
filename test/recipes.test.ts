import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ItemStore } from '../src/data/items.ts';
import { runMigrations } from '../src/data/migrations.ts';
import { tagsForItem } from '../src/data/tags.ts';
import { setLogLevel } from '../src/lib/logger.ts';
import type { AppContext } from '../src/services/database.ts';
import { newRecipeDraft } from '../src/services/recipe-draft.ts';
import { addRecipe } from '../src/services/recipes.ts';
import { openTestDatabase } from './support/driver-node.ts';
import { createMemoryFileStore } from './support/files-memory.ts';

setLogLevel('error');

async function freshContext(): Promise<AppContext> {
  const driver = openTestDatabase();
  const schemaVersion = await runMigrations(driver);
  return { driver, items: new ItemStore(driver), files: createMemoryFileStore(), schemaVersion };
}

async function rowCount(context: AppContext): Promise<number> {
  const rows = await context.driver.query<{ count: number }>('SELECT COUNT(*) AS count FROM items');
  return rows[0]?.count ?? 0;
}

/**
 * SPECS §2.2, Back: adding a recipe is an edit in progress until Save. Backing out of it
 * never reaches the service at all, so the only thing to prove here is that nothing
 * before a successful Save writes a row.
 */
describe('adding a recipe', function addSuite() {
  it('writes nothing when the first save is refused', async function refused() {
    const context = await freshContext();
    const result = await addRecipe(context, { ...newRecipeDraft('Bolo'), servings: '0' });

    assert.equal(result.ok, false);
    assert.equal(await rowCount(context), 0, 'nothing under Deleted either: there is no row');
    await context.driver.close();
  });

  it('creates the recipe, with its tags, on a valid save', async function saved() {
    const context = await freshContext();
    const result = await addRecipe(
      context,
      {
        ...newRecipeDraft('Feijão tropeiro'),
        ingredients: [{ qty: '500', unit: 'g', name: 'feijão' }],
      },
      ['mineira'],
    );

    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(await rowCount(context), 1);
    assert.equal(result.recipe.title, 'Feijão tropeiro');
    assert.deepEqual(result.recipe.payload.ingredients, [{ qty: 500, unit: 'g', name: 'feijão' }]);
    assert.deepEqual(await tagsForItem(context.driver, result.recipe.id), ['mineira']);
    await context.driver.close();
  });
});
