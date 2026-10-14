/**
 * Whether a finished touch was a page-turning swipe (`docs/modules/reading-queue.md`
 * criterion 11a).
 *
 * Pure, so the thresholds and the zoomed-page rule are tests rather than feel.
 */

export interface Gesture {
  /** Horizontal travel in CSS pixels; negative is right-to-left. */
  dx: number;
  dy: number;
  durationMs: number;
  /** Whether, when the touch began, the page could still scroll in each direction. */
  couldScrollLeft: boolean;
  couldScrollRight: boolean;
}

/** Far enough that a tap or a wobble never turns a page. */
const MIN_DISTANCE = 60;

/** Mostly sideways: scrolling down a page must never turn it. */
const HORIZONTAL_DOMINANCE = 2;

/** A swipe is quick. A slow sideways drag is someone panning a zoomed page. */
const MAX_DURATION_MS = 700;

export function swipeTurn(gesture: Gesture): 'next' | 'previous' | null {
  const { dx, dy, durationMs } = gesture;
  if (Math.abs(dx) < MIN_DISTANCE) return null;
  if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_DOMINANCE) return null;
  if (durationMs > MAX_DURATION_MS) return null;

  // Finger right-to-left: the content moves left, revealing what is to the right — the
  // rest of a zoomed page if there is any, the next page if not.
  if (dx < 0) return gesture.couldScrollRight ? null : 'next';
  return gesture.couldScrollLeft ? null : 'previous';
}
