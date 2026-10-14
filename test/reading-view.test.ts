import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ItemStore } from '../src/data/items.ts';
import { runMigrations } from '../src/data/migrations.ts';
import { validatePayload } from '../src/data/payload.ts';
import { ValidationError } from '../src/lib/errors.ts';
import { setLogLevel } from '../src/lib/logger.ts';
import { exportDatabase, importDatabase } from '../src/services/backup.ts';
import { findContentBox, WHOLE_PAGE } from '../src/services/content-box.ts';
import type { AppContext } from '../src/services/database.ts';
import { saveLastPage, saveReadingView, snapZoom, viewOf } from '../src/services/reading.ts';
import { openTestDatabase } from './support/driver-node.ts';
import { createMemoryFileStore } from './support/files-memory.ts';

setLogLevel('error');

/** A white page with one dark rectangle drawn where the text would be. */
function page(
  width: number,
  height: number,
  ink: { x0: number; y0: number; x1: number; y1: number } | null,
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  if (ink === null) return pixels;
  for (let y = ink.y0; y < ink.y1; y += 1) {
    for (let x = ink.x0; x < ink.x1; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 20;
      pixels[offset + 1] = 20;
      pixels[offset + 2] = 20;
    }
  }
  return pixels;
}

describe('finding a page’s content (reading-queue.md 15a)', function boxSuite() {
  it('boxes the inked region, with a little room around it', function boxes() {
    // An A4-shaped page with text from 15% to 85% across and 10% to 90% down.
    const box = findContentBox(page(200, 283, { x0: 30, y0: 28, x1: 170, y1: 255 }), 200, 283);
    assert.ok(Math.abs(box.left - 0.13) < 0.001, `left ${box.left}`);
    assert.ok(Math.abs(box.right - 0.87) < 0.001, `right ${box.right}`);
    assert.ok(box.top < 0.1 && box.top > 0.07);
    assert.ok(box.bottom > 0.9 && box.bottom < 0.93);
  });

  it('shows a blank page whole', function blank() {
    assert.deepEqual(findContentBox(page(100, 141, null), 100, 141), WHOLE_PAGE);
  });

  it('shows a page whole when its side margins are too thin to be worth it', function thin() {
    // Ink from 1% to 99% across: trimming would save almost nothing.
    assert.deepEqual(
      findContentBox(page(100, 141, { x0: 1, y0: 10, x1: 99, y1: 130 }), 100, 141),
      WHOLE_PAGE,
    );
  });

  it('ignores near-white noise such as a scan’s paper tone', function noise() {
    const pixels = page(100, 141, { x0: 30, y0: 30, x1: 70, y1: 110 });
    // A faint grey speck in the corner, lighter than ink.
    pixels[0] = 240;
    pixels[1] = 240;
    pixels[2] = 240;
    const box = findContentBox(pixels, 100, 141);
    assert.ok(box.left > 0.2, 'the speck must not drag the box to the corner');
  });
});

describe('zoom steps (reading-queue.md 15b)', function zoomSuite() {
  it('snaps a stored zoom to the nearest step, and defaults to 100%', function snaps() {
    assert.equal(snapZoom(undefined), 1);
    assert.equal(snapZoom(1.4), 1.5);
    assert.equal(snapZoom(2.2), 2);
    assert.equal(snapZoom(2.5), 2.5);
  });

  it('refuses a stored zoom outside 100–250%, and a non-boolean trim', function payload() {
    assert.throws(() => validatePayload('reading', { zoom: 4 }), ValidationError);
    assert.throws(() => validatePayload('reading', { zoom: 0.5 }), ValidationError);
    assert.throws(() => validatePayload('reading', { trim_margins: 'yes' }), ValidationError);
    assert.deepEqual(validatePayload('reading', { zoom: 1.5, trim_margins: true }), {
      zoom: 1.5,
      trim_margins: true,
    });
  });
});

async function freshReading() {
  const driver = openTestDatabase();
  const schemaVersion = await runMigrations(driver);
  const files = createMemoryFileStore();
  const context: AppContext = { driver, items: new ItemStore(driver), files, schemaVersion };
  const reading = await context.items.create({
    type: 'reading',
    title: 'GNSS/INS review',
    payload: { pdf_path: 'pdfs/x.pdf', page_count: 14, last_page: 1 },
  });
  return { context, files, readingId: reading.id };
}

describe('remembering the view per document (reading-queue.md 15c)', function viewSuite() {
  it('keeps the view and the page apart: saving one never undoes the other', async function apart() {
    const { context, readingId } = await freshReading();
    await saveLastPage(context, readingId, 6);
    await saveReadingView(context, readingId, { zoom: 2, trimMargins: true });
    await saveLastPage(context, readingId, 7);

    const reading = await context.items.get(readingId);
    assert.deepEqual(reading?.payload, {
      pdf_path: 'pdfs/x.pdf',
      page_count: 14,
      last_page: 7,
      zoom: 2,
      trim_margins: true,
    });
    await context.driver.close();
  });

  it('opens at 100% with whole pages when nothing was saved', async function defaults() {
    const { context, readingId } = await freshReading();
    const reading = await context.items.get(readingId);
    assert.equal(reading?.type, 'reading');
    if (reading?.type !== 'reading') return;
    assert.deepEqual(viewOf(reading), { zoom: 1, trimMargins: false });
    await context.driver.close();
  });

  it('survives an export and import', async function backup() {
    const { context, files, readingId } = await freshReading();
    await saveReadingView(context, readingId, { zoom: 1.5, trimMargins: true });
    await exportDatabase(context.driver, files, { includePdfs: false });
    await context.driver.close();

    const target = openTestDatabase();
    await runMigrations(target);
    await importDatabase(target, files);
    const restored = await new ItemStore(target).get(readingId);
    assert.equal(restored?.type, 'reading');
    if (restored?.type !== 'reading') return;
    assert.deepEqual(viewOf(restored), { zoom: 1.5, trimMargins: true });
    await target.close();
  });
});
