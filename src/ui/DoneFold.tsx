import { Icon } from './Icon.tsx';
import { useHoldReveal } from './use-hold-reveal.ts';

/**
 * The Done line under a checkable list (SPECS §2.2, The list). A tap opens and closes it.
 * Held still, it uncovers one Delete for every row under it, as a held row uncovers its own
 * — the same hook, so the same timing, and the same two steps between a stray hold and
 * anything leaving the list. Where a row slides aside, this narrows: see `.fold-hold` in
 * theme.css for why.
 *
 * The hold's handlers sit on the face, not on the fold button inside it: the click that ends
 * a hold is caught there, before it can also toggle the fold.
 */

interface DoneFoldProps {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  /** Absent where the list offers no deleting, and then a hold does nothing. */
  onDeleteAll?: () => void;
}

export function DoneFold({ count, expanded, onToggle, onDeleteAll }: DoneFoldProps) {
  const reveal = useHoldReveal(onDeleteAll !== undefined);
  return (
    <div class={reveal.open ? 'fold-hold fold-hold--open' : 'fold-hold'}>
      {onDeleteAll === undefined ? null : (
        <button
          type="button"
          class="row__delete"
          aria-label={`Delete all ${count} done`}
          tabIndex={reveal.open ? 0 : -1}
          onClick={onDeleteAll}
        >
          <Icon name="trash" size={20} />
          Delete all
        </button>
      )}
      <div class="fold-hold__face" {...reveal.handlers}>
        <button type="button" class="fold" aria-expanded={expanded} onClick={onToggle}>
          <span class="fold__mark">
            <Icon name="check" size={14} />
          </span>
          <span class="fold__label">Done</span>
          <span class="fold__count">{count}</span>
          <Icon name="chevronDown" size={18} />
        </button>
      </div>
    </div>
  );
}
