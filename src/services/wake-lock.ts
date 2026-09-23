/**
 * Kitchen mode's screen hold (SPECS §6, `docs/modules/cookbook.md` criteria 10–13).
 *
 * Uses the platform's Screen Wake Lock API rather than `@capacitor-community/keep-awake`:
 * CODESTYLE §11 prefers a platform API to a package, and a package would need an ADR. MDN
 * marks Android WebView as mirroring Chrome Android's support, and Capacitor serves the
 * app from `https://localhost`, which meets the API's secure-context requirement. That is
 * inherited data rather than a tested result, so every outcome is logged under
 * `kitchen.wake_lock` and reported to the screen — a refusal is never silent.
 */

import { log } from '../lib/logger.ts';

export type WakeLockOutcome = 'held' | 'unsupported' | 'refused';

/**
 * Keep the screen on until the returned function is called.
 *
 * The platform releases the lock whenever the page is hidden — switching apps, turning
 * the screen off — and does not take it back. So this re-acquires on every return to
 * visibility (criterion 12); without it the first glance at a message would end kitchen
 * mode for the rest of the recipe.
 *
 * @param onOutcome told after every attempt, so the screen can say when it may sleep.
 * @returns a release function, shaped for an effect's cleanup.
 */
export function keepScreenAwake(onOutcome: (outcome: WakeLockOutcome) => void): () => void {
  let sentinel: WakeLockSentinel | null = null;
  let released = false;

  async function acquire(): Promise<void> {
    if (released || sentinel !== null) return;
    if (!('wakeLock' in navigator)) {
      log.warn('kitchen.wake_lock', { outcome: 'unsupported' });
      onOutcome('unsupported');
      return;
    }
    try {
      const acquired = await navigator.wakeLock.request('screen');
      if (released) {
        // The recipe was closed while the request was in flight.
        await acquired.release();
        return;
      }
      sentinel = acquired;
      acquired.addEventListener('release', function onPlatformRelease() {
        sentinel = null;
      });
      log.info('kitchen.wake_lock', { outcome: 'held' });
      onOutcome('held');
    } catch (cause) {
      log.warn('kitchen.wake_lock', {
        outcome: 'refused',
        reason: cause instanceof Error ? cause.name : 'unknown',
      });
      onOutcome('refused');
    }
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible') void acquire();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  void acquire();

  return function releaseScreen() {
    released = true;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    const held = sentinel;
    sentinel = null;
    if (held !== null) void releaseHeld(held);
  };
}

/**
 * Hand the lock back. Cleanup cannot await, so this owns its own failure: a release that
 * throws is logged rather than left as an unhandled rejection (CODESTYLE §8).
 */
async function releaseHeld(held: WakeLockSentinel): Promise<void> {
  try {
    await held.release();
    log.info('kitchen.wake_lock', { outcome: 'released' });
  } catch (cause) {
    log.warn('kitchen.wake_lock', {
      outcome: 'release_failed',
      reason: cause instanceof Error ? cause.name : 'unknown',
    });
  }
}
