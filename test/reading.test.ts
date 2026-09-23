import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ItemStore } from '../src/data/items.ts';
import { runMigrations } from '../src/data/migrations.ts';
import { setLogLevel } from '../src/lib/logger.ts';
import { exportDatabase, importDatabase } from '../src/services/backup.ts';
import type { AppContext } from '../src/services/database.ts';
import { EXPORT_DIRECTORY } from '../src/services/files.ts';
import { purgeNow } from '../src/services/items.ts';
import type { PdfInspector } from '../src/services/reading.ts';
import {
  attachPdf,
  clampPage,
  readPdf,
  saveLastPage,
  saveReadingDetails,
} from '../src/services/reading.ts';
import { openTestDatabase } from './support/driver-node.ts';
import type { MemoryFileStore } from './support/files-memory.ts';
import { createMemoryFileStore } from './support/files-memory.ts';

setLogLevel('error');

const PDF_ID = '11111111-1111-4111-8111-111111111111';
const PDF_PATH = `pdfs/${PDF_ID}.pdf`;

/** Starts with the PDF signature. PDF.js is faked, so the rest need not be a real PDF. */
const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\n% a stand-in for a real document\n');

const fourteenPages: PdfInspector = { countPages: async () => 14 };
const unreadable: PdfInspector = {
  countPages: async () => {
    throw new Error('InvalidPDFException');
  },
};

async function freshContext(files: MemoryFileStore = createMemoryFileStore()) {
  const driver = openTestDatabase();
  const schemaVersion = await runMigrations(driver);
  const context: AppContext = { driver, items: new ItemStore(driver), files, schemaVersion };
  const created = await context.items.create({ type: 'reading', title: 'GNSS/INS review' });
  return { context, files, readingId: created.id };
}

const attachOptions = { inspector: fourteenPages, newId: () => PDF_ID };

describe('attaching a PDF (ADR-004)', function attachSuite() {
  it('copies the file into private storage and records the copy', async function copies() {
    const { context, files, readingId } = await freshContext();
    const result = await attachPdf(context, readingId, PDF_BYTES, attachOptions);

    assert.ok(result.ok);
    if (!result.ok) return;
    assert.deepEqual(result.reading.payload, {
      pdf_path: PDF_PATH,
      page_count: 14,
      last_page: 1,
    });
    assert.deepEqual(await files.readBytes('private', PDF_PATH), PDF_BYTES);
    await context.driver.close();
  });

  it('refuses a file that is not a PDF, and writes nothing', async function notPdf() {
    const { context, files, readingId } = await freshContext();
    const result = await attachPdf(
      context,
      readingId,
      new TextEncoder().encode('just some notes'),
      attachOptions,
    );

    assert.equal(result.ok, false);
    assert.deepEqual(files.paths('private'), [], 'nothing copied');
    assert.deepEqual((await context.items.get(readingId))?.payload, {}, 'nothing recorded');
    await context.driver.close();
  });

  it('refuses a PDF that cannot be read, and writes nothing', async function damaged() {
    const { context, files, readingId } = await freshContext();
    const result = await attachPdf(context, readingId, PDF_BYTES, {
      ...attachOptions,
      inspector: unreadable,
    });

    assert.equal(result.ok, false);
    assert.deepEqual(files.paths('private'), []);
    await context.driver.close();
  });

  it('finds the signature after leading bytes, as the format allows', async function leadingJunk() {
    const { context, readingId } = await freshContext();
    const padded = new Uint8Array([0x00, 0x0a, 0x0d, ...PDF_BYTES]);
    const result = await attachPdf(context, readingId, padded, attachOptions);
    assert.ok(result.ok);
    await context.driver.close();
  });

  it('refuses a second PDF rather than orphaning the first', async function second() {
    const { context, readingId } = await freshContext();
    await attachPdf(context, readingId, PDF_BYTES, attachOptions);
    const again = await attachPdf(context, readingId, PDF_BYTES, {
      ...attachOptions,
      newId: () => '22222222-2222-4222-8222-222222222222',
    });

    assert.equal(again.ok, false);
    const reading = await context.items.get(readingId);
    assert.equal(reading?.type === 'reading' ? reading.payload.pdf_path : null, PDF_PATH);
    await context.driver.close();
  });
});

describe('reading an attached PDF', function readSuite() {
  it('reads the copy back', async function readsBack() {
    const { context, readingId } = await freshContext();
    const attached = await attachPdf(context, readingId, PDF_BYTES, attachOptions);
    assert.ok(attached.ok);
    if (!attached.ok) return;

    const lookup = await readPdf(context, attached.reading);
    assert.equal(lookup.status, 'ok');
    if (lookup.status !== 'ok') return;
    assert.deepEqual(lookup.bytes, PDF_BYTES);
    await context.driver.close();
  });

  it('reports a missing file plainly instead of failing', async function missing() {
    const { context, files, readingId } = await freshContext();
    const attached = await attachPdf(context, readingId, PDF_BYTES, attachOptions);
    assert.ok(attached.ok);
    if (!attached.ok) return;

    // As after importing an export made without PDFs.
    await files.deleteFile('private', PDF_PATH);
    assert.deepEqual(await readPdf(context, attached.reading), { status: 'missing' });
    await context.driver.close();
  });

  it('says there is nothing to read when no PDF is attached', async function none() {
    const { context, readingId } = await freshContext();
    const reading = await context.items.get(readingId);
    assert.equal(reading?.type, 'reading');
    if (reading?.type !== 'reading') return;
    assert.deepEqual(await readPdf(context, reading), { status: 'none' });
    await context.driver.close();
  });
});

describe('remembering the page', function pageSuite() {
  it('keeps the last page and leaves the rest of the payload alone', async function saves() {
    const { context, readingId } = await freshContext();
    await attachPdf(context, readingId, PDF_BYTES, attachOptions);
    await saveLastPage(context, readingId, 6);

    const reading = await context.items.get(readingId);
    assert.deepEqual(reading?.payload, { pdf_path: PDF_PATH, page_count: 14, last_page: 6 });
    await context.driver.close();
  });

  it('clamps a stored page into the document', function clamps() {
    assert.equal(clampPage(undefined, 14), 1);
    assert.equal(clampPage(6, 14), 6);
    assert.equal(clampPage(40, 14), 14, 'a page past the end opens on the last one');
    assert.equal(clampPage(0, 14), 1);
    assert.equal(clampPage(2.5, 14), 1);
  });
});

describe('the attached file across delete, purge and backup', function lifecycleSuite() {
  it('survives a soft delete and restore (SPECS §4.1)', async function softDelete() {
    const { context, files, readingId } = await freshContext();
    await attachPdf(context, readingId, PDF_BYTES, attachOptions);
    await saveLastPage(context, readingId, 6);

    await context.items.softDelete(readingId);
    assert.ok(await files.exists('private', PDF_PATH), 'a soft delete keeps the file');

    await context.items.restore(readingId);
    const reading = await context.items.get(readingId);
    assert.equal(reading?.type === 'reading' ? reading.payload.last_page : null, 6);
    await context.driver.close();
  });

  it('is removed with the entry by purge', async function purge() {
    const { context, files, readingId } = await freshContext();
    await attachPdf(context, readingId, PDF_BYTES, attachOptions);

    await context.items.softDelete(readingId);
    const summary = await purgeNow(context);

    assert.equal(summary.purgedRows, 1);
    assert.equal(summary.removedFiles, 1);
    assert.equal(await files.exists('private', PDF_PATH), false);
    await context.driver.close();
  });

  it('travels in an export and comes back on a fresh install', async function backup() {
    const shared = createMemoryFileStore();
    const source = await freshContext(shared);
    await attachPdf(source.context, source.readingId, PDF_BYTES, attachOptions);
    await saveLastPage(source.context, source.readingId, 6);

    const exported = await exportDatabase(source.context.driver, shared);
    assert.equal(exported.pdfCount, 1);
    assert.ok(shared.paths('export').includes(`${EXPORT_DIRECTORY}/${PDF_PATH}`));
    await source.context.driver.close();

    // A wiped phone: the app's private copy is gone, only the export survives.
    await shared.deleteFile('private', PDF_PATH);

    const target = openTestDatabase();
    await runMigrations(target);
    const result = await importDatabase(target, shared);
    assert.equal(result.restoredPdfs, 1);

    const restoredStore = new ItemStore(target);
    const reading = await restoredStore.get(source.readingId);
    assert.equal(reading?.type, 'reading');
    if (reading?.type !== 'reading') return;
    assert.equal(reading.payload.last_page, 6, 'it opens where it was left');
    assert.deepEqual(await shared.readBytes('private', PDF_PATH), PDF_BYTES);
    await target.close();
  });
});

describe('title and URL', function detailsSuite() {
  it('stores the URL exactly as typed and clears it when blank', async function url() {
    const { context, readingId } = await freshContext();
    await saveReadingDetails(context, readingId, {
      title: 'GNSS/INS review',
      url: '  example.org/paper  ',
    });
    assert.equal((await context.items.get(readingId))?.url, 'example.org/paper');

    await saveReadingDetails(context, readingId, { title: 'GNSS/INS review', url: ' ' });
    assert.equal((await context.items.get(readingId))?.url, null);
    await context.driver.close();
  });

  it('refuses a blank title', async function title() {
    const { context, readingId } = await freshContext();
    const result = await saveReadingDetails(context, readingId, { title: '  ', url: '' });
    assert.equal(result.ok, false);
    await context.driver.close();
  });
});
