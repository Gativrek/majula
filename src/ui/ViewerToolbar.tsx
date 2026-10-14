import type { ReadingView } from '../services/reading.ts';
import { ZOOM_STEPS } from '../services/reading.ts';

/**
 * The PDF viewer's size controls (`docs/modules/reading-queue.md` 15a–15d): trim margins,
 * and the zoom steps. They sit above the page; turning pages stays at the thumb.
 */

interface ViewerToolbarProps {
  view: ReadingView;
  disabled: boolean;
  onChange: (view: ReadingView) => void;
}

const SMALLEST = ZOOM_STEPS[0] ?? 1;
const LARGEST = ZOOM_STEPS[ZOOM_STEPS.length - 1] ?? 1;

export function ViewerToolbar({ view, disabled, onChange }: ViewerToolbarProps) {
  function stepZoom(by: number): void {
    const index = ZOOM_STEPS.indexOf(view.zoom);
    const next = ZOOM_STEPS[Math.min(Math.max(index + by, 0), ZOOM_STEPS.length - 1)];
    if (next !== undefined && next !== view.zoom) onChange({ ...view, zoom: next });
  }

  return (
    <div class="viewer__toolbar" role="toolbar" aria-label="Reading size">
      <button
        type="button"
        class="chip"
        aria-pressed={view.trimMargins}
        disabled={disabled}
        onClick={() => onChange({ ...view, trimMargins: !view.trimMargins })}
      >
        Trim margins
      </button>
      <div class="viewer__zoom">
        <button
          type="button"
          class="icon-button"
          aria-label="Zoom out"
          disabled={disabled || view.zoom <= SMALLEST}
          onClick={() => stepZoom(-1)}
        >
          {'−'}
        </button>
        <span class="viewer__zoom-level" aria-live="polite">
          {`${Math.round(view.zoom * 100)}%`}
        </span>
        <button
          type="button"
          class="icon-button"
          aria-label="Zoom in"
          disabled={disabled || view.zoom >= LARGEST}
          onClick={() => stepZoom(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
