import { useEffect, useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import { formatAmount } from '../services/recipe-draft.ts';
import type { WakeLockOutcome } from '../services/wake-lock.ts';
import { keepScreenAwake } from '../services/wake-lock.ts';
import { Icon } from './Icon.tsx';
import { StarRating } from './StarRating.tsx';

/**
 * Kitchen mode (SPECS §6, `docs/modules/cookbook.md` criteria 9–15): large type, the
 * screen held awake, and Close and Edit in the lower half where a thumb reaches them.
 *
 * Large type comes from the `.kitchen` scope redefining the theme's size variables, not
 * from overrides here (CODESTYLE §12). Amounts sit in their own column so the names line
 * up and can be scanned down the counter.
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

  const { servings, ingredients, steps, rating } = recipe.payload;
  const warning = sleepWarning(outcome);

  return (
    <div class="kitchen">
      <main class="kitchen__body">
        <div class="kitchen__status">
          {outcome === 'held' ? (
            <span class="pill">
              <Icon name="eye" size={18} />
              Screen stays on
            </span>
          ) : null}
          <span class="kitchen__servings">
            <Icon name="servings" size={20} />
            {`Serves ${servings.toLocaleString()}`}
          </span>
        </div>

        <div class="kitchen__heading-block">
          <h2 class="kitchen__title">{recipe.title}</h2>
          {rating === undefined ? null : <StarRating rating={rating} />}
        </div>

        {warning === null ? null : <p class="banner banner--error">{warning}</p>}

        {ingredients.length === 0 ? null : (
          <section class="kitchen__section">
            <h3 class="kicker">Ingredients</h3>
            <ul class="kitchen__ingredients">
              {ingredients.map((ingredient, index) => (
                // Ingredients have no id of their own; position is their identity inside a
                // payload that is replaced whole on every save.
                <li key={index}>
                  <span class="kitchen__amount">{formatAmount(ingredient)}</span>
                  <span>{ingredient.name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {steps.length === 0 ? null : (
          <section class="kitchen__section">
            <h3 class="kicker">Steps</h3>
            <ol class="kitchen__steps">
              {steps.map((step, index) => (
                <li key={index}>
                  <span class="kitchen__step-number">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {ingredients.length === 0 && steps.length === 0 ? (
          <p class="empty">No ingredients or steps yet. Tap Edit to add them.</p>
        ) : null}
      </main>

      <footer class="kitchen__actions">
        <button
          type="button"
          class="button button--quiet button--square"
          aria-label="Close"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        <button type="button" class="button" onClick={onEdit}>
          <Icon name="edit" size={20} />
          Edit
        </button>
      </footer>
    </div>
  );
}
