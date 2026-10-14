/**
 * Holding a list row still uncovers its Delete button (SPECS §2.2, The list). A sideways
 * swipe on the list changes category instead, so the row itself never slides with a finger.
 *
 * Pure, so what counts as holding still is a test rather than feel.
 */

/** How far the row slides to uncover Delete, in CSS pixels. */
export const REVEAL_WIDTH = 88;

/** Movement below this is still a hold; beyond it the finger is scrolling or swiping. */
export const LOCK_DISTANCE = 8;

/** Holding still this long uncovers Delete. Long enough that a slow tap never does it. */
export const HOLD_MS = 450;

/** Whether a finger that went down on a row has moved too far for a hold. */
export function leftHold(dx: number, dy: number): boolean {
  return Math.abs(dx) >= LOCK_DISTANCE || Math.abs(dy) >= LOCK_DISTANCE;
}
