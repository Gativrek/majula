import { useRef, useState } from 'react';
import { REVEAL_WIDTH, axisOf, dragOffset, settlesOpen } from './row-swipe.ts';

/**
 * A row's face follows a sideways drag and rests either closed or open on its Delete
 * button (`row-swipe.ts` decides which).
 *
 * The face is `touch-action: pan-y` in the stylesheet, so a vertical drag stays the
 * browser's scroll and only a sideways one reaches here. A tap that ends a swipe, or lands
 * on an open row, closes it instead of reaching the row's own buttons.
 */

interface Gesture {
  pointerId: number;
  x: number;
  y: number;
  axis: 'horizontal' | 'vertical' | null;
  wasOpen: boolean;
}

export interface SwipeReveal {
  offset: number;
  dragging: boolean;
  open: boolean;
  handlers: {
    onPointerDown: (event: PointerEvent) => void;
    onPointerMove: (event: PointerEvent) => void;
    onPointerUp: (event: PointerEvent) => void;
    onPointerCancel: (event: PointerEvent) => void;
    onClickCapture: (event: MouseEvent) => void;
  };
}

export function useSwipeReveal(enabled: boolean): SwipeReveal {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const justSwiped = useRef(false);

  function rest(nowOpen: boolean): void {
    setDragging(false);
    setOpen(nowOpen);
    setOffset(nowOpen ? -REVEAL_WIDTH : 0);
  }

  function onPointerDown(event: PointerEvent): void {
    if (!enabled || !event.isPrimary) return;
    justSwiped.current = false;
    gesture.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      axis: null,
      wasOpen: open,
    };
  }

  function onPointerMove(event: PointerEvent): void {
    const current = gesture.current;
    if (current === null || event.pointerId !== current.pointerId) return;
    const dx = event.clientX - current.x;
    if (current.axis === null) {
      current.axis = axisOf(dx, event.clientY - current.y);
      if (current.axis !== 'horizontal') return;
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
      setDragging(true);
    }
    if (current.axis !== 'horizontal') return;
    justSwiped.current = true;
    setOffset(dragOffset(dx, current.wasOpen));
  }

  function finish(event: PointerEvent, cancelled: boolean): void {
    const current = gesture.current;
    if (current === null || event.pointerId !== current.pointerId) return;
    gesture.current = null;
    if (current.axis !== 'horizontal') return;
    rest(cancelled ? current.wasOpen : settlesOpen(event.clientX - current.x, current.wasOpen));
  }

  function onClickCapture(event: MouseEvent): void {
    if (!justSwiped.current && !open) return;
    event.preventDefault();
    event.stopPropagation();
    if (!justSwiped.current) rest(false);
    justSwiped.current = false;
  }

  return {
    offset,
    dragging,
    open,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (event) => finish(event, false),
      onPointerCancel: (event) => finish(event, true),
      onClickCapture,
    },
  };
}
