/**
 * PDF.js, behind the smallest surface the reading queue needs (ADR-004).
 *
 * This module is only ever reached through a dynamic `import()` from `reading.ts`. PDF.js
 * is about a megabyte plus its worker, and a static import would put it on the path to
 * the first keystroke that SPECS §6 budgets at about two seconds.
 *
 * Every URL below is local. PDF.js fetches character maps, standard fonts and its image
 * decoders at runtime, and `scripts/copy-pdfjs-assets.mjs` bundles them into the app;
 * reaching for a CDN instead would fail in airplane mode (§6).
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

const ASSETS = `${import.meta.env.BASE_URL}pdfjs/`;

/** An open PDF. Close it when the viewer closes, or the worker keeps the file in memory. */
export interface PdfHandle {
  pageCount: number;
  /**
   * Draw one page into `canvas`, fitted to `cssWidth`, at the device's pixel density so
   * text is sharp rather than scaled up from a smaller bitmap.
   */
  renderPage(pageNumber: number, canvas: HTMLCanvasElement, cssWidth: number): Promise<void>;
  close(): Promise<void>;
}

async function load(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  return getDocument({
    // PDF.js takes ownership of the buffer and detaches it; hand it a copy so the caller's
    // bytes stay usable.
    data: bytes.slice(),
    cMapUrl: `${ASSETS}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSETS}standard_fonts/`,
    wasmUrl: `${ASSETS}wasm/`,
    iccUrl: `${ASSETS}iccs/`,
  }).promise;
}

/** Parse just far enough to count pages, and prove the bytes are a PDF at all. */
export async function countPages(bytes: Uint8Array): Promise<number> {
  const document = await load(bytes);
  try {
    return document.numPages;
  } finally {
    await document.loadingTask.destroy();
  }
}

export async function openPdf(bytes: Uint8Array): Promise<PdfHandle> {
  const document = await load(bytes);

  return {
    pageCount: document.numPages,

    async renderPage(pageNumber, canvas, cssWidth) {
      const page = await document.getPage(pageNumber);
      const unscaled = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: cssWidth / unscaled.width });
      const density = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * density);
      canvas.height = Math.floor(viewport.height * density);
      // Width only. The height follows from the canvas's own proportions (`height: auto` in
      // the theme), so if the frame narrows before the next render — the phone rotating —
      // the page shrinks evenly instead of being squeezed sideways.
      canvas.style.width = `${Math.floor(viewport.width)}px`;

      await page.render({
        canvas,
        viewport,
        transform: density === 1 ? undefined : [density, 0, 0, density, 0, 0],
      }).promise;
      page.cleanup();
    },

    async close() {
      // PDF.js 6 closes a document through the task that loaded it.
      await document.loadingTask.destroy();
    },
  };
}
