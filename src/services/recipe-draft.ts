/**
 * The recipe editor's form state, and the one place it becomes a payload
 * (`docs/modules/cookbook.md`).
 *
 * Pure, so every rule about what the owner typed — decimal commas, blank rows, a quantity
 * with no name — is a test rather than behaviour discovered at the counter.
 */

import type { RecipeIngredient, RecipePayload } from '../data/types.ts';

/** Every field is the string the input holds. Nothing is parsed until save. */
export interface IngredientDraft {
  qty: string;
  unit: string;
  name: string;
}

export interface RecipeDraft {
  title: string;
  servings: string;
  ingredients: IngredientDraft[];
  steps: string[];
}

export type DraftResult =
  | { ok: true; title: string; payload: RecipePayload }
  | { ok: false; field: string; message: string };

export const EMPTY_INGREDIENT: IngredientDraft = { qty: '', unit: '', name: '' };

/**
 * A separator followed by exactly three digits, after one to three digits that do not
 * start with zero. In English `1.000` is one and `1,000` is a thousand; in Portuguese it
 * is the other way round. Nothing in the input says which the owner meant.
 */
const AMBIGUOUS_QUANTITY = /^[1-9]\d{0,2}[.,]\d{3}$/;

export type ParsedQuantity = number | undefined | 'invalid' | 'ambiguous';

/**
 * Parse a quantity as typed on a phone keyboard.
 *
 * Accepts `.` or `,` as the decimal separator, because Portuguese recipes are typed on a
 * keyboard that may offer either (cookbook.md criterion 4). That makes `1.000` and
 * `2,500` ambiguous — a thousand or one, two and a half or two thousand five hundred — so
 * they are refused rather than guessed. Guessing wrong turns a kilo of flour into a gram
 * with nothing on screen to say so.
 *
 * @returns the number; `undefined` for a blank field; `'invalid'` when it is not a number;
 * `'ambiguous'` when it is a number in one convention and a different one in the other.
 */
export function parseQuantity(raw: string): ParsedQuantity {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (AMBIGUOUS_QUANTITY.test(trimmed)) return 'ambiguous';
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : 'invalid';
}

function quantityProblem(parsed: 'invalid' | 'ambiguous', subject: string, raw: string): string {
  return parsed === 'ambiguous'
    ? `${subject} "${raw.trim()}" could mean two different numbers. Write it without the separator, or with fewer digits after it.`
    : `${subject} is not a number.`;
}

function isBlank(ingredient: IngredientDraft): boolean {
  return (
    ingredient.qty.trim().length === 0 &&
    ingredient.unit.trim().length === 0 &&
    ingredient.name.trim().length === 0
  );
}

function fail(field: string, message: string): DraftResult {
  return { ok: false, field, message };
}

/**
 * Turn the editor's state into a payload, or say exactly which field is wrong.
 *
 * A blank row is dropped, but a row with a quantity and no name is refused: dropping it
 * would silently discard something the owner typed (cookbook.md criterion 5).
 */
export function buildRecipe(draft: RecipeDraft): DraftResult {
  const title = draft.title.trim();
  if (title.length === 0) return fail('title', 'A recipe needs a title.');

  const servings = parseQuantity(draft.servings);
  if (servings === 'invalid' || servings === 'ambiguous') {
    return fail('servings', quantityProblem(servings, 'Servings', draft.servings));
  }
  if (servings === undefined || servings <= 0) {
    return fail('servings', 'Servings must be a number above zero.');
  }

  const ingredients: RecipeIngredient[] = [];
  for (const [index, row] of draft.ingredients.entries()) {
    if (isBlank(row)) continue;
    const position = index + 1;
    const name = row.name.trim();
    if (name.length === 0) {
      return fail(`ingredient ${position}`, `Ingredient ${position} has a quantity but no name.`);
    }
    const qty = parseQuantity(row.qty);
    if (qty === 'invalid' || qty === 'ambiguous') {
      return fail(
        `ingredient ${position}`,
        quantityProblem(qty, `Ingredient ${position}'s quantity`, row.qty),
      );
    }
    const ingredient: RecipeIngredient = { name };
    if (qty !== undefined) ingredient.qty = qty;
    const unit = row.unit.trim();
    if (unit.length > 0) ingredient.unit = unit;
    ingredients.push(ingredient);
  }

  const steps = draft.steps.map((step) => step.trim()).filter((step) => step.length > 0);

  return { ok: true, title, payload: { servings, ingredients, steps } };
}

/**
 * The editor's starting state for a recipe being added from quick capture. Nothing exists
 * in the database yet, and nothing will until Save (cookbook.md criterion 1).
 */
export function newRecipeDraft(title: string): RecipeDraft {
  return { title, servings: '1', ingredients: [], steps: [] };
}

/** The editor's starting state for an existing recipe. */
export function draftFromRecipe(title: string, payload: RecipePayload): RecipeDraft {
  return {
    title,
    servings: String(payload.servings),
    ingredients: payload.ingredients.map((ingredient) => ({
      qty: ingredient.qty === undefined ? '' : String(ingredient.qty),
      unit: ingredient.unit ?? '',
      name: ingredient.name,
    })),
    steps: [...payload.steps],
  };
}

/**
 * One ingredient as a line of text for kitchen mode. The device's own locale formats the
 * number, so `0.5` reads as `0,5` on a phone set to Portuguese.
 */
export function formatIngredient(ingredient: RecipeIngredient): string {
  const parts: string[] = [];
  if (ingredient.qty !== undefined) {
    parts.push(ingredient.qty.toLocaleString(undefined, { maximumFractionDigits: 3 }));
  }
  if (ingredient.unit !== undefined) parts.push(ingredient.unit);
  parts.push(ingredient.name);
  return parts.join(' ');
}
