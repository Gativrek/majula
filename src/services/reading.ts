/**
 * The reading queue (`docs/modules/reading-queue.md`): attaching a PDF by copying it into
 * private storage (ADR-004), reading it back, and remembering the page.
 */

import type { ItemOfType, ReadingPayload } from '../data/types.ts';
import type { IdGenerator } from '../lib/ids.ts';
import { randomId } from '../lib/ids.ts';
import { StorageError } from '../lib/errors.ts';
import { log } from '../lib/logger.ts';
import type { AppContext } from './database.ts';
import type { FileStore } from './files.ts';
import { EXPORT_PDF_DIRECTORY } from './files.ts';
import type { PdfHandle } from './pdf-document.ts';

/** How the service learns a PDF's page count. Injected so tests need not load PDF.js. */
export interface PdfInspector {
  countPages(file: Blob): Promise<number>;
}

/**
 * PDF.js loads only when first needed. A static import would put about a megabyte on the
 * path to the first keystroke (SPECS §6).
 */
async function pdfModule(): Promise<typeof import('./pdf-document.ts')> {
  return import('./pdf-document.ts');
}

const pdfJsInspector: PdfInspector = {
  async countPages(file) {
    return (await pdfModule()).countPages(file);
  },
};

/** `%PDF-`. The format allows up to 1024 bytes of leading junk before it. */
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];
const SIGNATURE_WINDOW = 1024;

function looksLikePdf(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length - PDF_SIGNATURE.length, SIGNATURE_WINDOW);
  for (let start = 0; start <= limit; start += 1) {
    if (PDF_SIGNATURE.every((byte, offset) => bytes[start + offset] === byte)) return true;
  }
  return false;
}

/** Only the start of a file is needed to check its signature. */
async function startsLikePdf(file: Blob): Promise<boolean> {
  const head = file.slice(0, SIGNATURE_WINDOW + PDF_SIGNATURE.length);
  return looksLikePdf(new Uint8Array(await head.arrayBuffer()));
}

/**
 * How much of a PDF is read and written at a time. A whole large PDF read into memory and
 * sent to the native side as base64 at once ran the app out of memory (a 56 MB file did).
 */
const COPY_CHUNK = 512 * 1024;

/** Copy a picked file into storage a piece at a time, never holding all of it at once. */
async function copyIntoStorage(files: FileStore, path: string, file: Blob): Promise<void> {
  for (let offset = 0; offset === 0 || offset < file.size; offset += COPY_CHUNK) {
    const piece = new Uint8Array(await file.slice(offset, offset + COPY_CHUNK).arrayBuffer());
    if (offset === 0) await files.writeBytes('private', path, piece);
    else await files.appendBytes('private', path, piece);
  }
}

async function currentReading(
  context: AppContext,
  id: string,
): Promise<ItemOfType<'reading'> | null> {
  const item = await context.items.get(id);
  return item?.type === 'reading' ? item : null;
}

export type AttachResult =
  { ok: true; reading: ItemOfType<'reading'> } | { ok: false; message: string };

function refuse(id: string, reason: string, message: string): AttachResult {
  log.info('reading.attach_refused', { id, reason });
  return { ok: false, message };
}

export interface AttachOptions {
  inspector?: PdfInspector;
  newId?: IdGenerator;
}

/**
 * Copy a picked PDF into private storage and attach it (ADR-004).
 *
 * The entry refers to the copy, so the original can then be moved or deleted
 * (reading-queue.md criteria 5–6). Nothing is written until the bytes have proved to be a
 * readable PDF, and a copy whose database write fails is removed rather than left
 * referenced by nothing.
 */
export async function attachPdf(
  context: AppContext,
  readingId: string,
  file: Blob,
  options: AttachOptions = {},
): Promise<AttachResult> {
  const reading = await currentReading(context, readingId);
  if (reading === null) {
    return refuse(readingId, 'not_found', 'This entry no longer exists.');
  }
  if (reading.payload.pdf_path !== undefined) {
    // reading-queue.md criterion 9: replacing would orphan the old copy.
    return refuse(readingId, 'already_attached', 'This entry already has a PDF.');
  }
  if (!(await startsLikePdf(file))) {
    return refuse(readingId, 'not_pdf', 'That file is not a PDF.');
  }

  let pageCount: number;
  try {
    pageCount = await (options.inspector ?? pdfJsInspector).countPages(file);
  } catch (cause) {
    log.info('reading.attach_refused', {
      id: readingId,
      reason: 'unreadable',
      detail: cause instanceof Error ? cause.name : 'unknown',
    });
    return { ok: false, message: 'That PDF could not be read. It may be damaged or encrypted.' };
  }

  const path = `${EXPORT_PDF_DIRECTORY}/${(options.newId ?? randomId)()}.pdf`;
  await context.files.ensureDirectory('private', EXPORT_PDF_DIRECTORY);
  try {
    await copyIntoStorage(context.files, path, file);
  } catch (cause) {
    // A half-written copy is never left behind for nothing to refer to.
    if (await context.files.exists('private', path))
      await context.files.deleteFile('private', path);
    throw new StorageError(
      'could not copy the PDF',
      { operation: 'attachPdf', id: readingId },
      { cause },
    );
  }

  try {
    const updated = await context.items.update<'reading'>(readingId, {
      payload: { pdf_path: path, page_count: pageCount, last_page: 1 },
    });
    if (updated.type !== 'reading') {
      throw new StorageError('entry changed type during attach', {
        operation: 'attachPdf',
        type: updated.type,
        id: readingId,
      });
    }
    log.info('reading.pdf_attached', { id: readingId, pages: pageCount });
    return { ok: true, reading: updated };
  } catch (cause) {
    await context.files.deleteFile('private', path);
    throw new StorageError(
      'could not record the attached PDF',
      { operation: 'attachPdf', type: 'reading', id: readingId },
      { cause },
    );
  }
}

export type PdfLookup = { status: 'none' } | { status: 'missing' } | { status: 'ok'; url: string };

/**
 * Find an entry's PDF in private storage, as a URL the viewer reads it from. The bytes
 * are not read here: a large PDF read through the bridge at once runs the app out of memory.
 *
 * `missing` is a real state, not an error: an import from an export made without PDFs
 * leaves entries naming files that are not on this phone (reading-queue.md criterion 15).
 * It is logged, never silent (CODESTYLE §6).
 */
export async function locatePdf(
  context: AppContext,
  reading: ItemOfType<'reading'>,
): Promise<PdfLookup> {
  const path = reading.payload.pdf_path;
  if (path === undefined) return { status: 'none' };
  if (!(await context.files.exists('private', path))) {
    log.warn('reading.pdf_missing', { id: reading.id });
    return { status: 'missing' };
  }
  return { status: 'ok', url: await context.files.fileUrl('private', path) };
}

export type OpenedPdf =
  | { status: 'none' }
  | { status: 'missing' }
  | { status: 'ok'; handle: PdfHandle; startPage: number };

/**
 * Open an entry's PDF for the viewer, on the page it was last left on (criterion 12).
 *
 * Takes an id and reads the stored entry rather than accepting the caller's copy: a copy
 * taken when the entry was opened carries the page from then, and reopening the viewer
 * after reading on would start from the wrong page.
 */
export async function openReadingPdf(context: AppContext, readingId: string): Promise<OpenedPdf> {
  const reading = await currentReading(context, readingId);
  if (reading === null) return { status: 'none' };
  const lookup = await locatePdf(context, reading);
  if (lookup.status !== 'ok') return lookup;
  const handle = await (await pdfModule()).openPdf(lookup.url);
  return {
    status: 'ok',
    handle,
    startPage: clampPage(reading.payload.last_page, handle.pageCount),
  };
}

export function clampPage(page: number | undefined, pageCount: number): number {
  if (page === undefined || !Number.isInteger(page)) return 1;
  return Math.min(Math.max(page, 1), Math.max(pageCount, 1));
}

/**
 * Remember the page the owner is on. Reads the stored payload first rather than trusting
 * the caller's copy, so a page turn can never write back a stale `pdf_path`.
 */
export async function saveLastPage(
  context: AppContext,
  readingId: string,
  page: number,
): Promise<void> {
  const reading = await currentReading(context, readingId);
  if (reading === null) return;
  const payload: ReadingPayload = { ...reading.payload, last_page: page };
  await context.items.update<'reading'>(readingId, { payload });
}

export type DetailsResult = { ok: true } | { ok: false; message: string };

/**
 * Save the title and URL. The URL is stored exactly as typed (CODESTYLE §1); a blank one
 * clears it. Whether it is openable is the screen's concern, not the store's.
 */
export async function saveReadingDetails(
  context: AppContext,
  readingId: string,
  details: { title: string; url: string },
): Promise<DetailsResult> {
  const title = details.title.trim();
  if (title.length === 0) return { ok: false, message: 'An entry needs a title.' };
  const url = details.url.trim();
  await context.items.update<'reading'>(readingId, {
    title,
    url: url.length === 0 ? null : url,
  });
  return { ok: true };
}

/** reading-queue.md 15b: the zoom steps. Four buttons' worth, not a free scale. */
export const ZOOM_STEPS: readonly number[] = [1, 1.5, 2, 2.5];

/** How the viewer draws a document, remembered with its last page (criterion 15c). */
export interface ReadingView {
  zoom: number;
  trimMargins: boolean;
}

/** The nearest zoom step to a stored value; 100% when there is none. */
export function snapZoom(zoom: number | undefined): number {
  if (zoom === undefined) return 1;
  return ZOOM_STEPS.reduce((best, step) =>
    Math.abs(step - zoom) < Math.abs(best - zoom) ? step : best,
  );
}

export function viewOf(reading: ItemOfType<'reading'>): ReadingView {
  return {
    zoom: snapZoom(reading.payload.zoom),
    trimMargins: reading.payload.trim_margins ?? false,
  };
}

/**
 * Remember how a document is being read. Re-reads the stored payload first, as
 * `saveLastPage` does, so changing the zoom can never write back a stale page.
 */
export async function saveReadingView(
  context: AppContext,
  readingId: string,
  view: ReadingView,
): Promise<void> {
  const reading = await currentReading(context, readingId);
  if (reading === null) return;
  const payload: ReadingPayload = {
    ...reading.payload,
    zoom: snapZoom(view.zoom),
    trim_margins: view.trimMargins,
  };
  await context.items.update<'reading'>(readingId, { payload });
}
