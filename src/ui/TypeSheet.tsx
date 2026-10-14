import type { CategoryId } from './categories.ts';
import { CAPTURE_CATEGORIES, category } from './categories.ts';
import { Icon } from './Icon.tsx';

/**
 * Every capturable type, opened from the capture bar's type button. Here the icons carry
 * their names, since this is where a type is chosen deliberately rather than at a glance.
 */

interface TypeSheetProps {
  selected: CategoryId;
  onPick: (id: CategoryId) => void;
  onDismiss: () => void;
}

export function TypeSheet({ selected, onPick, onDismiss }: TypeSheetProps) {
  return (
    <div class="sheet-layer">
      <button type="button" class="sheet-layer__scrim" aria-label="Close" onClick={onDismiss} />
      <div class="sheet" role="dialog" aria-label="Capture as">
        <span class="sheet__grabber" aria-hidden="true" />
        <h2 class="kicker">Capture as</h2>
        <div class="type-grid">
          {CAPTURE_CATEGORIES.map(function option(id) {
            const shown = category(id);
            return (
              <button
                key={id}
                type="button"
                class="type-grid__option"
                aria-pressed={selected === id}
                onClick={() => onPick(id)}
              >
                <Icon name={shown.icon} />
                {shown.captureLabel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
