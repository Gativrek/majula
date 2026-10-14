import type { SetDraft } from '../services/workout-draft.ts';

/**
 * A folded exercise in a workout reads as one line, and a set changed from the routine is
 * marked. Pure, so "the same" and "changed" are tests rather than what a screen happened to
 * show. Sets are compared as typed: `60` and `60,0` are a change, because the owner typed it.
 */

/** `3 × 10 · 30 kg` when every set matches, `3 × 10` when only the reps do, else `3 sets`. */
export function summariseSets(sets: readonly SetDraft[]): string {
  const first = sets[0];
  if (first === undefined) return 'Skipped';
  const count = sets.length;
  const sameReps = sets.every((set) => set.reps.trim() === first.reps.trim());
  const sameLoad = sets.every((set) => set.load.trim() === first.load.trim());
  if (!sameReps) return `${count} set${count === 1 ? '' : 's'}`;
  const scheme = `${count} × ${first.reps.trim()}`;
  return sameLoad && first.load.trim() !== '' ? `${scheme} · ${first.load.trim()} kg` : scheme;
}

/** A set the owner added, or changed from what the routine pre-filled. */
export function isChanged(set: SetDraft, planned: SetDraft | null): boolean {
  if (planned === null) return true;
  return set.reps.trim() !== planned.reps.trim() || set.load.trim() !== planned.load.trim();
}
