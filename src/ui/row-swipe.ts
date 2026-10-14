/**
 * Swipe a list row left to reveal its Delete button (SPECS §2.2, The list).
 *
 * Pure, so where the row comes to rest is a test rather than feel. The row follows the
 * finger while it moves; these decide what happens when the finger lifts.
 */

/** How far the row slides to uncover Delete, in CSS pixels. */
export const REVEAL_WIDTH = 88;

/** Movement below this is a tap, or the start of a scroll, not yet a swipe. */
export const LOCK_DISTANCE = 8;

/**
 * Whether a moving finger has committed to sliding the row. Only a mostly sideways move
 * does: a vertical one is the list scrolling and must be left to the browser.
 */
export function axisOf(dx: number, dy: number): 'horizontal' | 'vertical' | null {
  if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return null;
  return Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
}

/** The row's offset while dragging: never right of rest, never past the button. */
export function dragOffset(dx: number, wasOpen: boolean): number {
  const start = wasOpen ? -REVEAL_WIDTH : 0;
  return Math.min(0, Math.max(-REVEAL_WIDTH, start + dx));
}

/** Where the row rests after the finger lifts: open once it is more than halfway. */
export function settlesOpen(dx: number, wasOpen: boolean): boolean {
  return dragOffset(dx, wasOpen) < -REVEAL_WIDTH / 2;
}

/**
 * Holding a row still this long uncovers Delete too: the same button, found without
 * knowing to swipe. Long enough that a slow tap never does it.
 */
export const HOLD_MS = 450;
