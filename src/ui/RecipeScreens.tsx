import { useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import type { AppContext } from '../services/database.ts';
import type { RecipeDraft } from '../services/recipe-draft.ts';
import { draftFromRecipe } from '../services/recipe-draft.ts';
import { addRecipe, getRecipe, saveRecipe } from '../services/recipes.ts';
import { RecipeEditor } from './RecipeEditor.tsx';
import { RecipeView } from './RecipeView.tsx';
import { useBackStep } from './use-back-step.ts';

/**
 * The cookbook's screens (`docs/modules/cookbook.md`): a recipe read in kitchen mode,
 * being edited, or being added. A new recipe is only a draft — it has no row until Save
 * (SPECS §2.2, Back).
 */

export type RecipeScreen =
  | { mode: 'view'; recipe: ItemOfType<'recipe'> }
  | { mode: 'edit'; recipe: ItemOfType<'recipe'> }
  | { mode: 'new'; draft: RecipeDraft; tags: string[] };

interface RecipeScreensProps {
  context: AppContext;
  initial: RecipeScreen;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function RecipeScreens({ context, initial, onClose, onChanged }: RecipeScreensProps) {
  const [screen, setScreen] = useState<RecipeScreen>(initial);

  // SPECS §2.2, Back: back closes the recipe — a new one having written nothing — and,
  // while an existing one is being edited, first returns to it unchanged.
  useBackStep(true, onClose);
  useBackStep(screen.mode === 'edit', function cancelEdit() {
    setScreen((current) =>
      current.mode === 'edit' ? { mode: 'view', recipe: current.recipe } : current,
    );
  });

  if (screen.mode === 'new') {
    const { tags } = screen;
    return (
      <RecipeEditor
        initial={screen.draft}
        onSave={async (draft) => {
          const result = await addRecipe(context, draft, tags);
          if (result.ok) {
            setScreen({ mode: 'view', recipe: result.recipe });
            await onChanged();
          }
          return result;
        }}
        onCancel={onClose}
      />
    );
  }

  const { recipe } = screen;
  if (screen.mode === 'edit') {
    return (
      <RecipeEditor
        initial={draftFromRecipe(recipe.title, recipe.payload)}
        onSave={async (draft) => {
          const result = await saveRecipe(context, recipe.id, draft);
          if (result.ok) {
            const saved = await getRecipe(context, recipe.id);
            if (saved === null) onClose();
            else setScreen({ mode: 'view', recipe: saved });
            await onChanged();
          }
          return result;
        }}
        onCancel={() => setScreen({ mode: 'view', recipe })}
      />
    );
  }

  return (
    <RecipeView
      recipe={recipe}
      onClose={onClose}
      onEdit={() => setScreen({ mode: 'edit', recipe })}
    />
  );
}
