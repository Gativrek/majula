/**
 * What the UI may do with recipes (`docs/modules/cookbook.md`).
 */

import { setTags } from '../data/tags.ts';
import type { ItemOfType } from '../data/types.ts';
import type { AppContext } from './database.ts';
import type { DraftResult, RecipeDraft } from './recipe-draft.ts';
import { buildRecipe } from './recipe-draft.ts';

/**
 * Quick capture's recipe path: a title, one serving, nothing else. The caller opens it
 * straight into the editor (cookbook.md criterion 1), so it is never left half-made
 * without the owner seeing it.
 */
export async function createRecipe(
  context: AppContext,
  title: string,
  tags: readonly string[] = [],
): Promise<ItemOfType<'recipe'>> {
  const item = await context.items.create({
    type: 'recipe',
    title,
    payload: { servings: 1, ingredients: [], steps: [] },
  });
  if (tags.length > 0) await setTags(context.driver, item.id, tags);
  return asRecipe(item);
}

export async function getRecipe(
  context: AppContext,
  id: string,
): Promise<ItemOfType<'recipe'> | null> {
  const item = await context.items.get(id);
  if (item === null) return null;
  return asRecipe(item);
}

/**
 * Save the editor's state. Nothing is written unless the whole draft is valid
 * (cookbook.md criterion 7), and the result says which field is wrong when it is not.
 */
export async function saveRecipe(
  context: AppContext,
  id: string,
  draft: RecipeDraft,
): Promise<DraftResult> {
  const result = buildRecipe(draft);
  if (!result.ok) return result;
  await context.items.update<'recipe'>(id, { title: result.title, payload: result.payload });
  return result;
}

function asRecipe(item: Awaited<ReturnType<AppContext['items']['create']>>): ItemOfType<'recipe'> {
  if (item.type !== 'recipe') {
    throw new Error(`expected a recipe, got ${item.type} (${item.id})`);
  }
  return item;
}
