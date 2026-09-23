import { useEffect, useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import { formatIngredient } from '../services/recipe-draft.ts';
import type { WakeLockOutcome } from '../services/wake-lock.ts';
import { keepScreenAwake } from '../services/wake-lock.ts';

/**
 * Kitchen mode (SPECS §6, `docs/modules/cookbook.md` criteria 9–15): large type, the
 * screen held awake, and Close and Edit in the lower half where a thumb reaches them.
 *
 * Large type comes from the `.kitchen` scope redefining the theme's size variables, not
 * from overrides here (CODESTYLE §12).
 */

interface RecipeViewProps {
  recipe: ItemOfType<'recipe'>;
  onClose: () => void;
  onEdit: () => void;
}

function sleepWarning(outcome: WakeLockOutcome | null): string | null {
  if (outcome === 'unsupported') return 'This device cannot keep the screen on. It may sleep.';
  if (outcome === 'refused') return 'The screen could not be kept on. It may sleep.';
  return null;
}

export function RecipeView({ recipe, onClose, onEdit }: RecipeViewProps) {
  const [outcome, setOutcome] = useState<WakeLockOutcome | null>(null);

  useEffect(function holdScreenWhileOpen() {
    return keepScreenAwake(setOutcome);
  }, []);

  const { servings, ingredients, steps } = recipe.payload;
  const warning = sleepWarning(outcome);

  return (
    <div class="kitchen">
      <main class="kitchen__body">
        <h2 class="kitchen__title">{recipe.title}</h2>
        <p class="kitchen__servings">
          {servings === 1 ? 'Serves 1' : `Serves ${servings.toLocaleString()}`}
        </p>

        {warning === null ? null : <p class="banner banner--error">{warning}</p>}

        {ingredients.length === 0 ? null : (
          <section class="kitchen__section">
            <h3 class="kitchen__heading">Ingredients</h3>
            <ul class="kitchen__ingredients">
              {ingredients.map((ingredient, index) => (
                // Ingredients have no id of their own; position is their identity inside a
                // payload that is replaced whole on every save.
                <li key={index}>{formatIngredient(ingredient)}</li>
              ))}
            </ul>
          </section>
        )}

        {steps.length === 0 ? null : (
          <section class="kitchen__section">
            <h3 class="kitchen__heading">Steps</h3>
            <ol class="kitchen__steps">
              {steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </section>
        )}

        {ingredients.length === 0 && steps.length === 0 ? (
          <p class="empty">No ingredients or steps yet. Tap Edit to add them.</p>
        ) : null}
      </main>

      <footer class="kitchen__actions">
        <button type="button" class="button button--quiet" onClick={onClose}>
          Close
        </button>
        <button type="button" class="button" onClick={onEdit}>
          Edit
        </button>
      </footer>
    </div>
  );
}
