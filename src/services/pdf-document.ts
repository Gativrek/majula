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

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import type { Box } from './content-box.ts';
import { findContentBox, WHOLE_PAGE } from './content-box.ts';

GlobalWorkerOptions.workerSrc = workerUrl;

const ASSETS = `${import.meta.env.BASE_URL}pdfjs/`;

/** How a page is drawn (reading-queue.md 15a–b). */
export interface RenderOptions {
  /** 1 fits the page, or its trimmed content, to the width; above 1 it is wider. */
  zoom: number;
  trimMargins: boolean;
}

/** An open PDF. Close it when the viewer closes, or the worker keeps the file in memory. */
export interface PdfHandle {
  pageCount: number;
  /**
   * Draw one page into `canvas` at `cssWidth` times the zoom, at the device's pixel
   * density so text is sharp rather than scaled up from a smaller bitmap.
   */
  renderPage(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    cssWidth: number,
    options: RenderOptions,
  ): Promise<void>;
  close(): Promise<void>;
}

/** The width the page is drawn at to find its margins. Enough to see a line of text. */
const PROBE_WIDTH = 320;

/**
 * The most canvas pixels one page may take. At 250% on a dense screen an A4 canvas would
 * otherwise run to about fifty megabytes; past this, resolution gives way rather than the
 * phone's memory. The page stays the same size on screen.
 */
const PIXEL_BUDGET = 16_000_000;

/** Draw a page small, off screen, and find where its content is. */
async function measureContent(page: PDFPageProxy): Promise<Box> {
  const unscaled = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: PROBE_WIDTH / unscaled.width });
  const probe = document.createElement('canvas');
  probe.width = Math.ceil(viewport.width);
  probe.height = Math.ceil(viewport.height);
  const context = probe.getContext('2d', { willReadFrequently: true });
  if (context === null) return WHOLE_PAGE;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, probe.width, probe.height);
  await page.render({ canvas: probe, viewport }).promise;
  const pixels = context.getImageData(0, 0, probe.width, probe.height).data;
  return findContentBox(pixels, probe.width, probe.height);
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
  const pdf = await load(bytes);
  try {
    return pdf.numPages;
  } finally {
    await pdf.loadingTask.destroy();
  }
}

export async function openPdf(bytes: Uint8Array): Promise<PdfHandle> {
  const pdf = await load(bytes);
  // A page's margins do not change, so each is measured once per opening.
  const contentBoxes = new Map<number, Box>();

  async function contentBoxOf(page: PDFPageProxy, pageNumber: number): Promise<Box> {
    const known = contentBoxes.get(pageNumber);
    if (known !== undefined) return known;
    const measured = await measureContent(page);
    contentBoxes.set(pageNumber, measured);
    return measured;
  }

  return {
    pageCount: pdf.numPages,

    async renderPage(pageNumber, canvas, cssWidth, options) {
      const page = await pdf.getPage(pageNumber);
      const box = options.trimMargins ? await contentBoxOf(page, pageNumber) : WHOLE_PAGE;
      const unscaled = page.getViewport({ scale: 1 });

      // The kept region, in PDF points, is what is fitted to the width.
      const regionWidth = unscaled.width * (box.right - box.left);
      const regionHeight = unscaled.height * (box.bottom - box.top);
      const scale = (cssWidth * options.zoom) / regionWidth;
      const viewport = page.getViewport({
        scale,
        offsetX: -box.left * unscaled.width * scale,
        offsetY: -box.top * unscaled.height * scale,
      });

      const cssPixelsWide = regionWidth * scale;
      const cssPixelsHigh = regionHeight * scale;
      const wanted = window.devicePixelRatio || 1;
      const density = Math.min(wanted, Math.sqrt(PIXEL_BUDGET / (cssPixelsWide * cssPixelsHigh)));

      canvas.width = Math.floor(cssPixelsWide * density);
      canvas.height = Math.floor(cssPixelsHigh * density);
      // Width only. The height follows from the canvas's own proportions (`height: auto` in
      // the theme), so if the frame narrows before the next render — the phone rotating —
      // the page shrinks evenly instead of being squeezed sideways.
      canvas.style.width = `${Math.floor(cssPixelsWide)}px`;

      await page.render({
        canvas,
        viewport,
        transform: density === 1 ? undefined : [density, 0, 0, density, 0, 0],
      }).promise;
      page.cleanup();
    },

    async close() {
      // PDF.js 6 closes a document through the task that loaded it.
      await pdf.loadingTask.destroy();
    },
  };
}
