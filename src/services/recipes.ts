/**
 * What the UI may do with recipes (`docs/modules/cookbook.md`).
 */

import { setTags } from '../data/tags.ts';
import type { Item, ItemOfType } from '../data/types.ts';
import type { AppContext } from './database.ts';
import type { DraftResult, RecipeDraft } from './recipe-draft.ts';
import { buildRecipe } from './recipe-draft.ts';

export type AddResult =
  { ok: true; recipe: ItemOfType<'recipe'> } | { ok: false; field: string; message: string };

/**
 * Create a recipe from the editor's first Save.
 *
 * Adding a recipe writes nothing until this is called (SPECS §2.2, Back; cookbook.md
 * criterion 1). Cancelling the add — with the button or the back button — never reaches
 * here, so it leaves no row behind, not even one under Deleted.
 */
export async function addRecipe(
  context: AppContext,
  draft: RecipeDraft,
  tags: readonly string[] = [],
): Promise<AddResult> {
  const result = buildRecipe(draft);
  if (!result.ok) return result;
  const item = await context.items.create({
    type: 'recipe',
    title: result.title,
    payload: result.payload,
  });
  if (tags.length > 0) await setTags(context.driver, item.id, tags);
  return { ok: true, recipe: asRecipe(item) };
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
 * Save an edit to an existing recipe. Nothing is written unless the whole draft is valid
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

function asRecipe(item: Item): ItemOfType<'recipe'> {
  if (item.type !== 'recipe') {
    throw new Error(`expected a recipe, got ${item.type} (${item.id})`);
  }
  return item;
}
