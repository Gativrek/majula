import type { CategoryId } from './categories.ts';
import { LIST_CATEGORIES, category } from './categories.ts';
import { Icon } from './Icon.tsx';

/**
 * The row of line icons below the habits that picks what the list shows (SPECS §2.2, The
 * list). Icons rather than words, so all eight fit one row; the list's heading names the
 * one selected.
 */

interface CategoryBubbleProps {
  selected: CategoryId | null;
  onSelect: (id: CategoryId) => void;
}

export function CategoryBubble({ selected, onSelect }: CategoryBubbleProps) {
  return (
    <nav class="bubble" aria-label="Show">
      {LIST_CATEGORIES.map(function option(id) {
        const shown = category(id);
        return (
          <button
            key={id}
            type="button"
            class="bubble__option"
            aria-pressed={selected === id}
            aria-label={shown.label}
            onClick={() => onSelect(id)}
          >
            <Icon name={shown.icon} size={20} />
          </button>
        );
      })}
    </nav>
  );
}
