import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { swipeTurn } from './swipe.ts';

/**
 * Swiping turns pages: the PDF viewer's (`docs/modules/reading-queue.md` criterion 11a)
 * and the list's categories (SPECS §2.2, The list).
 *
 * The listeners are passive and never cancel the browser's own scrolling; the touch is
 * judged only once the finger lifts, so a zoomed page still pans and a long page still
 * scrolls down. Whether the page could still scroll is read when the touch begins, so a
 * zoomed page turns only on a swipe that starts at its edge.
 *
 * @param onTurn called with +1 or -1; read through a ref, so it may change every render.
 * @param ignore a selector for parts of the surface that scroll sideways themselves; a
 *   touch that starts inside one is theirs, never a turn.
 */
export function useSwipePages(
  frame: RefObject<HTMLElement | null>,
  enabled: boolean,
  onTurn: (by: 1 | -1) => void,
  ignore?: string,
): void {
  const latest = useRef(onTurn);
  latest.current = onTurn;

  useEffect(
    function turnPagesOnSwipe() {
      const target = frame.current;
      if (!enabled || target === null) return undefined;
      const surface: HTMLElement = target;

      let start: {
        x: number;
        y: number;
        at: number;
        couldScrollLeft: boolean;
        couldScrollRight: boolean;
      } | null = null;

      function onTouchStart(event: TouchEvent): void {
        const touch = event.touches[0];
        // A second finger is a pinch or a mistake, never a page turn.
        if (event.touches.length !== 1 || touch === undefined) {
          start = null;
          return;
        }
        if (
          ignore !== undefined &&
          event.target instanceof Element &&
          event.target.closest(ignore) !== null
        ) {
          start = null;
          return;
        }
        start = {
          x: touch.clientX,
          y: touch.clientY,
          at: event.timeStamp,
          couldScrollLeft: surface.scrollLeft > 1,
          couldScrollRight: surface.scrollLeft + surface.clientWidth < surface.scrollWidth - 1,
        };
      }

      function onTouchEnd(event: TouchEvent): void {
        const touch = event.changedTouches[0];
        if (start === null || touch === undefined) return;
        const turn = swipeTurn({
          dx: touch.clientX - start.x,
          dy: touch.clientY - start.y,
          durationMs: event.timeStamp - start.at,
          couldScrollLeft: start.couldScrollLeft,
          couldScrollRight: start.couldScrollRight,
        });
        start = null;
        if (turn !== null) latest.current(turn === 'next' ? 1 : -1);
      }

      function onTouchCancel(): void {
        start = null;
      }

      surface.addEventListener('touchstart', onTouchStart, { passive: true });
      surface.addEventListener('touchend', onTouchEnd, { passive: true });
      surface.addEventListener('touchcancel', onTouchCancel, { passive: true });
      return function stopListening() {
        surface.removeEventListener('touchstart', onTouchStart);
        surface.removeEventListener('touchend', onTouchEnd);
        surface.removeEventListener('touchcancel', onTouchCancel);
      };
    },
    [frame, enabled, ignore],
  );
}
