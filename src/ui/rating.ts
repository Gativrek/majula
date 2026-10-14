/**
 * A recipe's rating as five stars (SPECS §4.3, Recipe rating): stored as 0–10 half stars,
 * shown and set as stars. Pure, so the half-star arithmetic is a test, not a look.
 */

export type StarFill = 'full' | 'half' | 'empty';

export const STAR_COUNT = 5;

export function starFills(rating: number): StarFill[] {
  return Array.from({ length: STAR_COUNT }, function fillOf(_, index): StarFill {
    const halves = rating - index * 2;
    if (halves >= 2) return 'full';
    return halves === 1 ? 'half' : 'empty';
  });
}

/**
 * Tapping a star fills up to it; tapping the star that is already the last full one makes
 * it a half (`docs/modules/cookbook.md` criterion 15b). Stars are numbered from 1.
 */
export function tapStar(current: number | null, star: number): number {
  const full = star * 2;
  return current === full ? full - 1 : full;
}

/** "3½ stars" for assistive technology and the editor's caption. */
export function ratingLabel(rating: number): string {
  const whole = Math.floor(rating / 2);
  if (rating === 1) return '½ star';
  const stars = rating % 2 === 1 ? `${whole}½` : String(whole);
  return `${stars} star${rating === 2 ? '' : 's'}`;
}
