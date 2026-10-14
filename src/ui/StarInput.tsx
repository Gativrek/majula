import { Star } from './Star.tsx';
import { STAR_COUNT, ratingLabel, starFills, tapStar } from './rating.ts';

/**
 * Setting a recipe's rating in the editor (`docs/modules/cookbook.md` criterion 15b).
 * Each star is a full-size button; tapping the last full star again halves it, so a half
 * star never needs a target half the width of a thumb.
 */

interface StarInputProps {
  rating: number | null;
  onChange: (rating: number | null) => void;
}

export function StarInput({ rating, onChange }: StarInputProps) {
  const fills = starFills(rating ?? 0);
  return (
    <div class="star-input">
      <div class="star-input__stars" role="group" aria-label="Rating">
        {Array.from({ length: STAR_COUNT }, (_, index) => (
          <button
            // Five fixed positions, never reordered: the index is the star.
            key={index}
            type="button"
            class="star-input__star"
            aria-label={`${index + 1} star${index === 0 ? '' : 's'}`}
            onClick={() => onChange(tapStar(rating, index + 1))}
          >
            <Star fill={fills[index] ?? 'empty'} size={28} />
          </button>
        ))}
      </div>
      <span class="star-input__caption">{rating === null ? 'Not rated' : ratingLabel(rating)}</span>
      {rating === null ? null : (
        <button type="button" class="star-input__clear" onClick={() => onChange(null)}>
          Clear
        </button>
      )}
    </div>
  );
}
