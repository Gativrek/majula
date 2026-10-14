import { useEffect, useRef, useState } from 'react';
import { log } from '../lib/logger.ts';
import type { PdfHandle } from '../services/pdf-document.ts';
import type { OpenedPdf, ReadingView } from '../services/reading.ts';
import { Icon } from './Icon.tsx';
import { useSwipePages } from './use-swipe-pages.ts';
import { ViewerToolbar } from './ViewerToolbar.tsx';

/**
 * The PDF viewer (`docs/modules/reading-queue.md` criteria 10–15d): one page at a time,
 * fitted to the screen width, Previous and Next at the thumb, and the page remembered.
 * Above the page, margin trimming and a stepped zoom, both remembered per document.
 *
 * No annotation, highlighting or notes of any kind (SPECS §1.1 item 8).
 */

interface PdfViewerProps {
  title: string;
  open: () => Promise<OpenedPdf>;
  initialView: ReadingView;
  onPageChange: (page: number) => void;
  onViewChange: (view: ReadingView) => void;
  onClose: () => void;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; handle: PdfHandle }
  | { kind: 'missing' }
  | { kind: 'failed'; message: string };

export function PdfViewer({
  title,
  open,
  initialView,
  onPageChange,
  onViewChange,
  onClose,
}: PdfViewerProps) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ReadingView>(initialView);
  const wantedView = useRef(initialView);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);

  // PDF.js refuses two renders into one canvas at once, and fast taps on Next would ask
  // for exactly that. So one render runs at a time, and whatever page is wanted when it
  // finishes is the next one drawn: taps during a render collapse into one.
  const wantedPage = useRef(1);
  const rendering = useRef(false);
  /** The width the canvas was last drawn for, so a refit happens only on a real change. */
  const renderedWidth = useRef(0);

  // The page as of the last tap, not the last render. Taps faster than a re-render would
  // otherwise all read the same `page` and step to the same target: a double tap would
  // turn one page, and save it twice.
  const currentPage = useRef(1);

  useEffect(
    function openDocument() {
      let closed = false;
      let opened: PdfHandle | null = null;
      async function load(): Promise<void> {
        try {
          const result = await open();
          if (result.status !== 'ok') {
            if (!closed) setStatus({ kind: 'missing' });
            return;
          }
          opened = result.handle;
          if (closed) {
            await result.handle.close();
            return;
          }
          wantedPage.current = result.startPage;
          currentPage.current = result.startPage;
          setPage(result.startPage);
          setStatus({ kind: 'ready', handle: result.handle });
        } catch (error) {
          if (!closed) {
            setStatus({
              kind: 'failed',
              message: error instanceof Error ? error.message : 'the PDF could not be opened',
            });
          }
        }
      }
      void load();
      return function closeDocument() {
        closed = true;
        if (opened !== null) void opened.close();
      };
    },
    [open],
  );

  /**
   * Called with `void` from effects and resize, so it owns every failure itself: nothing
   * it starts may reject unhandled (CODESTYLE §8).
   */
  async function drawWantedPage(handle: PdfHandle): Promise<void> {
    if (rendering.current) return;
    rendering.current = true;
    try {
      for (;;) {
        const target = wantedPage.current;
        const surface = canvas.current;
        const width = frame.current?.clientWidth ?? 0;
        if (surface === null || width === 0) return;
        const drawnView = wantedView.current;
        await handle.renderPage(target, surface, width, drawnView);
        renderedWidth.current = width;
        // Draw again if the page, the width or the view moved on while this render ran.
        if (
          wantedPage.current === target &&
          wantedView.current === drawnView &&
          frame.current?.clientWidth === width
        ) {
          return;
        }
      }
    } catch (error) {
      // Closing the viewer mid-render destroys the document, and PDF.js rejects the render
      // in flight. That is the close working, not a fault.
      if (error instanceof Error && error.name === 'RenderingCancelledException') {
        log.debug('reading.render_cancelled', {});
        return;
      }
      setStatus({
        kind: 'failed',
        message: error instanceof Error ? error.message : 'the page could not be drawn',
      });
    } finally {
      rendering.current = false;
    }
  }

  useEffect(
    function renderOnPageOrViewChange() {
      if (status.kind !== 'ready') return;
      wantedPage.current = page;
      wantedView.current = view;
      void drawWantedPage(status.handle);
    },
    [status, page, view],
  );

  // A new page starts at its top-left, not wherever the last one was scrolled to.
  useEffect(
    function scrollNewPageToStart() {
      frame.current?.scrollTo(0, 0);
    },
    [page],
  );

  // The page must refit whenever the viewer's own width changes: rotating the phone, split
  // screen, anything. Watching the element rather than the window catches all of them —
  // a window resize event is not guaranteed to arrive for every one.
  useEffect(
    function refitWhenWidthChanges() {
      const target = frame.current;
      if (status.kind !== 'ready' || target === null) return undefined;
      const { handle } = status;
      const observer = new ResizeObserver(function onResize() {
        // The observer also reports once on observe; skip it when nothing changed, so
        // opening a PDF does not draw its first page twice.
        if (target.clientWidth !== renderedWidth.current) void drawWantedPage(handle);
      });
      observer.observe(target);
      return function stopObserving() {
        observer.disconnect();
      };
    },
    [status],
  );

  function step(by: number): void {
    if (status.kind !== 'ready') return;
    const target = Math.min(Math.max(currentPage.current + by, 1), status.handle.pageCount);
    if (target === currentPage.current) return;
    currentPage.current = target;
    setPage(target);
    onPageChange(target);
  }

  // reading-queue.md 11a: swiping left or right turns the page.
  useSwipePages(frame, status.kind === 'ready', step);

  function changeView(next: ReadingView): void {
    setView(next);
    onViewChange(next);
  }

  const pageCount = status.kind === 'ready' ? status.handle.pageCount : 0;
  const ready = status.kind === 'ready';

  return (
    <div class="kitchen kitchen--editing viewer">
      <ViewerToolbar view={view} disabled={!ready} onChange={changeView} />

      <main class="viewer__body" ref={frame}>
        {status.kind === 'loading' ? <p class="empty">Opening {title}…</p> : null}
        {status.kind === 'missing' ? (
          <p class="banner banner--error">
            This PDF is not on this phone. It was probably restored from an export made without
            PDFs. The entry itself is untouched.
          </p>
        ) : null}
        {status.kind === 'failed' ? (
          <p class="banner banner--error">The PDF could not be opened: {status.message}.</p>
        ) : null}
        <canvas
          ref={canvas}
          class={view.zoom > 1 ? 'viewer__page viewer__page--zoomed' : 'viewer__page'}
          hidden={status.kind !== 'ready'}
          aria-label={`${title}, page ${page}`}
        />
      </main>

      <footer class="kitchen__actions viewer__actions">
        <button
          type="button"
          class="button button--quiet button--square"
          aria-label="Close"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        <button
          type="button"
          class="button button--quiet button--square"
          disabled={status.kind !== 'ready' || page <= 1}
          aria-label="Previous page"
          onClick={() => step(-1)}
        >
          <Icon name="back" />
        </button>
        <span class="viewer__position" aria-live="polite">
          {pageCount > 0 ? `p. ${page} of ${pageCount}` : ''}
        </span>
        <button
          type="button"
          class="button button--square"
          disabled={status.kind !== 'ready' || page >= pageCount}
          aria-label="Next page"
          onClick={() => step(1)}
        >
          <span class="icon-flip">
            <Icon name="back" />
          </span>
        </button>
      </footer>
    </div>
  );
}
