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
import { EXPORT_PDF_DIRECTORY } from './files.ts';
import type { PdfHandle } from './pdf-document.ts';

/** How the service learns a PDF's page count. Injected so tests need not load PDF.js. */
export interface PdfInspector {
  countPages(bytes: Uint8Array): Promise<number>;
}

/**
 * PDF.js loads only when first needed. A static import would put about a megabyte on the
 * path to the first keystroke (SPECS §6).
 */
async function pdfModule(): Promise<typeof import('./pdf-document.ts')> {
  return import('./pdf-document.ts');
}

const pdfJsInspector: PdfInspector = {
  async countPages(bytes) {
    return (await pdfModule()).countPages(bytes);
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
  bytes: Uint8Array,
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
  if (!looksLikePdf(bytes)) {
    return refuse(readingId, 'not_pdf', 'That file is not a PDF.');
  }

  let pageCount: number;
  try {
    pageCount = await (options.inspector ?? pdfJsInspector).countPages(bytes);
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
  await context.files.writeBytes('private', path, bytes);

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

export type PdfLookup =
  { status: 'none' } | { status: 'missing' } | { status: 'ok'; bytes: Uint8Array };

/**
 * Read an entry's PDF back from private storage.
 *
 * `missing` is a real state, not an error: an import from an export made without PDFs
 * leaves entries naming files that are not on this phone (reading-queue.md criterion 15).
 * It is logged, never silent (CODESTYLE §6).
 */
export async function readPdf(
  context: AppContext,
  reading: ItemOfType<'reading'>,
): Promise<PdfLookup> {
  const path = reading.payload.pdf_path;
  if (path === undefined) return { status: 'none' };
  if (!(await context.files.exists('private', path))) {
    log.warn('reading.pdf_missing', { id: reading.id });
    return { status: 'missing' };
  }
  return { status: 'ok', bytes: await context.files.readBytes('private', path) };
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
  const lookup = await readPdf(context, reading);
  if (lookup.status !== 'ok') return lookup;
  const handle = await (await pdfModule()).openPdf(lookup.bytes);
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
