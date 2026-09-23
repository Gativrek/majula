import { useEffect, useRef, useState } from 'react';
import { log } from '../lib/logger.ts';
import type { PdfHandle } from '../services/pdf-document.ts';
import type { OpenedPdf } from '../services/reading.ts';

/**
 * The PDF viewer (`docs/modules/reading-queue.md` criteria 10–15): one page at a time,
 * fitted to the screen width, Previous and Next at the thumb, and the page remembered.
 *
 * No annotation, highlighting or notes of any kind (SPECS §1.1 item 8).
 */

interface PdfViewerProps {
  title: string;
  open: () => Promise<OpenedPdf>;
  onPageChange: (page: number) => void;
  onClose: () => void;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; handle: PdfHandle }
  | { kind: 'missing' }
  | { kind: 'failed'; message: string };

export function PdfViewer({ title, open, onPageChange, onClose }: PdfViewerProps) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [page, setPage] = useState(1);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);

  // PDF.js refuses two renders into one canvas at once, and fast taps on Next would ask
  // for exactly that. So one render runs at a time, and whatever page is wanted when it
  // finishes is the next one drawn: taps during a render collapse into one.
  const wantedPage = useRef(1);
  const rendering = useRef(false);

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
        await handle.renderPage(target, surface, width);
        if (wantedPage.current === target) return;
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
    function renderOnPageOrResize() {
      if (status.kind !== 'ready') return undefined;
      const { handle } = status;
      wantedPage.current = page;
      void drawWantedPage(handle);
      function redraw(): void {
        void drawWantedPage(handle);
      }
      // Rotating the phone changes the width the page must fit.
      window.addEventListener('resize', redraw);
      return function stopRedrawing() {
        window.removeEventListener('resize', redraw);
      };
    },
    [status, page],
  );

  function step(by: number): void {
    if (status.kind !== 'ready') return;
    const target = Math.min(Math.max(currentPage.current + by, 1), status.handle.pageCount);
    if (target === currentPage.current) return;
    currentPage.current = target;
    setPage(target);
    onPageChange(target);
  }

  const pageCount = status.kind === 'ready' ? status.handle.pageCount : 0;

  return (
    <div class="kitchen kitchen--editing viewer">
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
          class="viewer__page"
          hidden={status.kind !== 'ready'}
          aria-label={`${title}, page ${page}`}
        />
      </main>

      <footer class="kitchen__actions viewer__actions">
        <button type="button" class="button button--quiet" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          class="button button--quiet"
          disabled={status.kind !== 'ready' || page <= 1}
          aria-label="Previous page"
          onClick={() => step(-1)}
        >
          {'‹'}
        </button>
        <span class="viewer__position" aria-live="polite">
          {pageCount > 0 ? `${page} / ${pageCount}` : ''}
        </span>
        <button
          type="button"
          class="button"
          disabled={status.kind !== 'ready' || page >= pageCount}
          aria-label="Next page"
          onClick={() => step(1)}
        >
          {'›'}
        </button>
      </footer>
    </div>
  );
}
