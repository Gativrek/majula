import { useEffect, useRef, useState } from 'react';
import { HOLD_MS, REVEAL_WIDTH, leftHold } from './row-hold.ts';

/**
 * Holding a row still slides its face aside to uncover Delete (`row-hold.ts`). A sideways
 * swipe is the list's, to change category, so moving the finger only cancels the hold.
 *
 * A tap that ends a hold, or lands on an open row, closes it instead of reaching the row's
 * own buttons.
 */

interface Press {
  pointerId: number;
  x: number;
  y: number;
}

export interface HoldReveal {
  offset: number;
  open: boolean;
  handlers: {
    onPointerDown: (event: PointerEvent) => void;
    onPointerMove: (event: PointerEvent) => void;
    onPointerUp: (event: PointerEvent) => void;
    onPointerCancel: (event: PointerEvent) => void;
    onClickCapture: (event: MouseEvent) => void;
    onContextMenu: (event: MouseEvent) => void;
  };
}

export function useHoldReveal(enabled: boolean): HoldReveal {
  const [open, setOpen] = useState(false);
  const press = useRef<Press | null>(null);
  const justOpened = useRef(false);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelHold(): void {
    if (hold.current !== null) clearTimeout(hold.current);
    hold.current = null;
  }

  useEffect(function stopHoldOnUnmount() {
    return cancelHold;
  }, []);

  function onPointerDown(event: PointerEvent): void {
    if (!enabled || !event.isPrimary) return;
    justOpened.current = false;
    press.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    cancelHold();
    if (open) return;
    hold.current = setTimeout(function revealOnHold() {
      hold.current = null;
      if (press.current === null) return;
      // The lift that ends this hold must not also tap the row's own buttons.
      justOpened.current = true;
      setOpen(true);
    }, HOLD_MS);
  }

  function onPointerMove(event: PointerEvent): void {
    const current = press.current;
    if (current === null || event.pointerId !== current.pointerId) return;
    if (leftHold(event.clientX - current.x, event.clientY - current.y)) {
      cancelHold();
      press.current = null;
    }
  }

  function finish(event: PointerEvent): void {
    if (press.current?.pointerId !== event.pointerId) return;
    cancelHold();
    press.current = null;
  }

  function onClickCapture(event: MouseEvent): void {
    if (!justOpened.current && !open) return;
    event.preventDefault();
    event.stopPropagation();
    if (!justOpened.current) setOpen(false);
    justOpened.current = false;
  }

  /** A hold is this row's own gesture, so the WebView's text-selection menu stays away. */
  function onContextMenu(event: MouseEvent): void {
    if (enabled) event.preventDefault();
  }

  return {
    offset: open ? -REVEAL_WIDTH : 0,
    open,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onClickCapture,
      onContextMenu,
    },
  };
}
