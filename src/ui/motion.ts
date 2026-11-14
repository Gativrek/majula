import type { CategoryId } from './categories.ts';
import { LIST_CATEGORIES } from './categories.ts';

/**
 * Motion's timings and its one browser API (SPECS §2.2, Look and motion). The styles are
 * in motion.css; this decides when a view transition runs and what it is called.
 *
 * A view transition photographs the screen, applies a change, photographs it again and
 * animates between the two. The change is applied whatever happens to the animation — a
 * browser without the API, reduced motion, or a transition the browser skips all leave the
 * change made, just not animated. Nothing here delays a write.
 */

/** How long a checked box shows its tick before its row folds away. */
export const TICK_MS = 260;

/** How long a tapped control stays marked: longer than its longest animation, 820ms. */
export const TAP_MARK_MS = 900;

/** False with reduced motion on — the only switch for motion there is (§1.1). */
export function motionAllowed(): boolean {
  return (
    typeof matchMedia === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Which way a category change slides: the way the finger went along the icon row. */
export function slideKind(from: CategoryId, to: CategoryId): 'cat-next' | 'cat-prev' | 'cat' {
  const before = LIST_CATEGORIES.indexOf(from);
  const after = LIST_CATEGORIES.indexOf(to);
  if (before < 0 || after < 0 || before === after) return 'cat';
  return after > before ? 'cat-next' : 'cat-prev';
}

// Which transition last set `data-vt`, so one that finishes late cannot clear a newer one's.
let latestTransition = 0;

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Apply `update` inside a view transition named `kind` on the root, for motion.css to pick
 * its animations by. Resolves once the change is applied and drawn, not when the animation
 * ends. Preact renders on a microtask, so one task after `update` the new screen is in
 * place for the browser's second photograph.
 */
export async function withViewTransition(
  kind: string,
  update: () => Promise<unknown>,
): Promise<void> {
  if (!motionAllowed() || typeof document.startViewTransition !== 'function') {
    await update();
    return;
  }
  const root = document.documentElement;
  latestTransition += 1;
  const ticket = latestTransition;
  root.dataset['vt'] = kind;
  const transition = document.startViewTransition(async function applyChange() {
    await update();
    await nextTask();
  });
  // A skipped transition is not a failure: the change was still applied.
  transition.ready.catch(() => undefined);
  void transition.finished
    .catch(() => undefined)
    .then(function clearKind() {
      if (ticket === latestTransition) delete root.dataset['vt'];
    });
  await transition.updateCallbackDone;
}
