import { useEffect, useMemo, useRef } from 'react';
import type { CategoryId } from './categories.ts';
import { TICK_MS, motionAllowed, slideKind, withViewTransition } from './motion.ts';

/**
 * The list's choreography (SPECS §2.2, Look and motion), kept out of HomeScreen.
 *
 * A category change is the awkward one: the new rows load after the render, so the
 * transition has to wait for that load before its second photograph, or it would slide in
 * an empty list. `settled` is how the list says its load landed; the wait is capped, so a
 * slow or failed load costs a moment of animation, never a frozen screen.
 */

/** The longest a category change waits for its list before animating what it has. */
const LOAD_WAIT_MS = 500;

export interface ListMotion {
  /** The list has loaded; a category change waiting for it can finish. */
  settled: () => void;
  /** Slide to another category; `change` makes the switch. */
  changeCategory: (from: CategoryId, to: CategoryId, change: () => void) => void;
  /** Animate a change to the list's rows: a delete, a capture. */
  animate: (kind: string, work: () => Promise<unknown>) => Promise<void>;
  /**
   * Fold a row away after its check. The caller has already started the write; only the
   * redraw waits, so the tick is seen. Unchecking needs no tick and redraws at once.
   */
  checkOff: (wasDone: boolean, redraw: () => Promise<unknown>) => void;
}

export function useListMotion(): ListMotion {
  const waiting = useRef<(() => void) | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(function cancelOnUnmount() {
    const pending = timers.current;
    return function cancel() {
      pending.forEach(clearTimeout);
      pending.clear();
      waiting.current?.();
    };
  }, []);

  return useMemo(function build(): ListMotion {
    function later(run: () => void, ms: number): void {
      const id = setTimeout(function fire() {
        timers.current.delete(id);
        run();
      }, ms);
      timers.current.add(id);
    }

    function settled(): void {
      const release = waiting.current;
      waiting.current = null;
      release?.();
    }

    function nextLoad(): Promise<void> {
      settled();
      return new Promise(function wait(resolve) {
        waiting.current = resolve;
        later(function giveUp() {
          if (waiting.current === resolve) settled();
        }, LOAD_WAIT_MS);
      });
    }

    return {
      settled,
      changeCategory(from, to, change) {
        void withViewTransition(slideKind(from, to), async function slide() {
          const loaded = nextLoad();
          change();
          await loaded;
        });
      },
      animate: withViewTransition,
      checkOff(wasDone, redraw) {
        const show = (): void => void withViewTransition('check', redraw);
        if (!wasDone && motionAllowed()) later(show, TICK_MS);
        else show();
      },
    };
  }, []);
}
