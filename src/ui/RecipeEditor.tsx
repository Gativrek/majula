import { useState } from 'react';
import type { IngredientDraft, RecipeDraft } from '../services/recipe-draft.ts';
import { EMPTY_INGREDIENT } from '../services/recipe-draft.ts';
import { Icon } from './Icon.tsx';
import { StarInput } from './StarInput.tsx';

/**
 * The recipe editor (`docs/modules/cookbook.md` criteria 1–8).
 *
 * Each ingredient is three separate fields. Nothing is parsed out of free text: "2 ovos"
 * typed into the name stays a name, for the same reason GATE P1 closed on no prefix
 * syntax in quick capture.
 */

/**
 * Rows are added and removed mid-list, so each needs a key that survives a removal above
 * it. Index keys would hand one row's typed value to its neighbour (CODESTYLE §12). The
 * key is editor state only and never reaches the payload.
 */
interface Row<T> {
  key: number;
  value: T;
}

let nextRowKey = 0;
function row<T>(value: T): Row<T> {
  nextRowKey += 1;
  return { key: nextRowKey, value };
}

/** All the editor needs from a save: it worked, or here is what to tell the owner. */
type SaveOutcome = { ok: true } | { ok: false; message: string };

interface RecipeEditorProps {
  /** An existing recipe's state, or a new one's that is not in the database yet. */
  initial: RecipeDraft;
  onSave: (draft: RecipeDraft) => Promise<SaveOutcome>;
  onCancel: () => void;
}

function inputValue(event: Event): string {
  return (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
}

export function RecipeEditor({ initial, onSave, onCancel }: RecipeEditorProps) {
  const [title, setTitle] = useState(initial.title);
  const [servings, setServings] = useState(initial.servings);
  const [rating, setRating] = useState(initial.rating);
  const [ingredients, setIngredients] = useState<Row<IngredientDraft>[]>(() =>
    (initial.ingredients.length > 0 ? initial.ingredients : [EMPTY_INGREDIENT]).map(row),
  );
  const [steps, setSteps] = useState<Row<string>[]>(() =>
    (initial.steps.length > 0 ? initial.steps : ['']).map(row),
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateIngredient(key: number, field: keyof IngredientDraft, value: string): void {
    setIngredients((rows) =>
      rows.map((entry) =>
        entry.key === key ? { key, value: { ...entry.value, [field]: value } } : entry,
      ),
    );
  }

  function updateStep(key: number, value: string): void {
    setSteps((rows) => rows.map((entry) => (entry.key === key ? { key, value } : entry)));
  }

  async function save(): Promise<void> {
    setSaving(true);
    setProblem(null);
    try {
      const result = await onSave({
        title,
        servings,
        ingredients: ingredients.map((entry) => entry.value),
        steps: steps.map((entry) => entry.value),
        rating,
      });
      if (!result.ok) setProblem(result.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="kitchen kitchen--editing">
      <main class="kitchen__body editor">
        <label class="editor__field">
          <span class="editor__label">Title</span>
          <input
            class="capture__input"
            type="text"
            value={title}
            onInput={(event) => setTitle(inputValue(event))}
          />
        </label>

        <label class="editor__field">
          <span class="editor__label">Servings</span>
          <input
            class="capture__input editor__narrow"
            type="text"
            inputMode="decimal"
            value={servings}
            onInput={(event) => setServings(inputValue(event))}
          />
        </label>

        <div class="editor__field">
          <span class="editor__label">How much you like it</span>
          <StarInput rating={rating} onChange={setRating} />
        </div>

        <section class="kitchen__section">
          <h3 class="kitchen__heading">Ingredients</h3>
          {ingredients.map((entry, index) => (
            <div key={entry.key} class="editor__ingredient">
              <input
                class="capture__input editor__qty"
                type="text"
                inputMode="decimal"
                placeholder="Qty"
                aria-label={`Ingredient ${index + 1} quantity`}
                value={entry.value.qty}
                onInput={(event) => updateIngredient(entry.key, 'qty', inputValue(event))}
              />
              <input
                class="capture__input editor__unit"
                type="text"
                placeholder="Unit"
                aria-label={`Ingredient ${index + 1} unit`}
                value={entry.value.unit}
                onInput={(event) => updateIngredient(entry.key, 'unit', inputValue(event))}
              />
              <input
                class="capture__input editor__name"
                type="text"
                placeholder="Ingredient"
                aria-label={`Ingredient ${index + 1} name`}
                value={entry.value.name}
                onInput={(event) => updateIngredient(entry.key, 'name', inputValue(event))}
              />
              <button
                type="button"
                class="icon-button"
                aria-label={`Remove ingredient ${index + 1}`}
                onClick={() => setIngredients((rows) => rows.filter((r) => r.key !== entry.key))}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          ))}
          <button
            type="button"
            class="button button--quiet"
            onClick={() => setIngredients((rows) => [...rows, row(EMPTY_INGREDIENT)])}
          >
            Add ingredient
          </button>
        </section>

        <section class="kitchen__section">
          <h3 class="kitchen__heading">Steps</h3>
          {steps.map((entry, index) => (
            <div key={entry.key} class="editor__step">
              <span class="editor__step-number">{index + 1}</span>
              <textarea
                class="capture__input editor__step-text"
                rows={2}
                aria-label={`Step ${index + 1}`}
                value={entry.value}
                onInput={(event) => updateStep(entry.key, inputValue(event))}
              />
              <button
                type="button"
                class="icon-button"
                aria-label={`Remove step ${index + 1}`}
                onClick={() => setSteps((rows) => rows.filter((r) => r.key !== entry.key))}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          ))}
          <button
            type="button"
            class="button button--quiet"
            onClick={() => setSteps((rows) => [...rows, row('')])}
          >
            Add step
          </button>
        </section>

        {problem === null ? null : <p class="banner banner--error">{problem}</p>}
      </main>

      <footer class="kitchen__actions">
        <button type="button" class="button button--quiet" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" class="button" disabled={saving} onClick={() => void save()}>
          Save
        </button>
      </footer>
    </div>
  );
}
