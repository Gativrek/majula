import { useCallback, useEffect, useRef, useState } from 'react';
import { TAP_MARK_MS } from './motion.ts';

/**
 * Remember which control was just touched, briefly, so motion.css animates that one and
 * not every logged habit or checked box that is on screen when the list loads. The key is
 * the caller's: a habit card marks the state it expects to reach, so its animation starts
 * when the data lands rather than on the stale value under the finger.
 */

export interface TapMark {
  /** True while `key` is the one marked; render it as `data-tapped`. */
  marked: (key: string) => boolean;
  mark: (key: string) => void;
}

export function useTapMark(): TapMark {
  const [current, setCurrent] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(function stopTimerOnUnmount() {
    return function cancel() {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const mark = useCallback(function markTapped(key: string): void {
    if (timer.current !== null) clearTimeout(timer.current);
    setCurrent(key);
    timer.current = setTimeout(function unmark() {
      timer.current = null;
      setCurrent(null);
    }, TAP_MARK_MS);
  }, []);

  return { marked: (key) => key === current, mark };
}

/** `data-tapped` as Preact wants it: present and empty, or absent. */
export function tappedAttribute(on: boolean): '' | undefined {
  return on ? '' : undefined;
}
