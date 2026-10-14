import { ratingLabel, starFills } from './rating.ts';
import { Star } from './Star.tsx';

/**
 * A recipe's rating, read-only: five small stars, filled in half steps
 * (`docs/modules/cookbook.md` criterion 15a). The caller shows nothing for an unrated
 * recipe; five empty stars would read as a rating of zero.
 */

export function StarRating({ rating }: { rating: number }) {
  return (
    <div class="stars" role="img" aria-label={`Rated ${ratingLabel(rating)} of 5`}>
      {starFills(rating).map((fill, index) => (
        // Five fixed positions, never reordered: the index is the star.
        <Star key={index} fill={fill} size={18} />
      ))}
    </div>
  );
}
