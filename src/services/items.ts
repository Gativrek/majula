/**
 * What the UI is allowed to ask for. Storage errors from the data layer are
 * translated here into something a screen can act on (CODESTYLE §4).
 */

import { countDeleted, purgeDeleted } from '../data/purge.ts';
import { setTags, tagsForItem } from '../data/tags.ts';
import type { Item, ItemType, NewItem } from '../data/types.ts';
import { log } from '../lib/logger.ts';
import type { AppContext } from './database.ts';
import { EXPORT_PDF_DIRECTORY } from './files.ts';

export interface CaptureInput {
  type: ItemType;
  title: string;
  body?: string;
  tags?: string[];
}

/**
 * Quick capture (SPECS §2.2). The type comes from the chips, never from parsing the
 * text: GATE P1 closed on no prefix syntax.
 */
export async function captureItem(context: AppContext, input: CaptureInput): Promise<Item> {
  const newItem: NewItem = { type: input.type, title: input.title };
  if (input.body !== undefined && input.body.length > 0) newItem.body = input.body;

  const item = await context.items.create(newItem);
  if (input.tags !== undefined && input.tags.length > 0) {
    await setTags(context.driver, item.id, input.tags);
  }
  return item;
}

export async function listItems(context: AppContext, type?: ItemType): Promise<Item[]> {
  return type === undefined ? context.items.list() : context.items.list({ type });
}

export async function listDeletedItems(context: AppContext): Promise<Item[]> {
  return context.items.listDeleted();
}

export async function loadTags(context: AppContext, itemId: string): Promise<string[]> {
  return tagsForItem(context.driver, itemId);
}

export async function toggleDone(context: AppContext, item: Item): Promise<Item> {
  return context.items.update(item.id, { done: !item.done });
}

/** SPECS §4.1: this retains any attached file. Only purge removes one. */
export async function deleteItem(context: AppContext, id: string): Promise<void> {
  await context.items.softDelete(id);
}

export async function restoreItem(context: AppContext, id: string): Promise<void> {
  await context.items.restore(id);
}

export async function countPurgeable(context: AppContext): Promise<number> {
  return countDeleted(context.driver);
}

export interface PurgeSummary {
  purgedRows: number;
  removedFiles: number;
}

/**
 * The global purge (SPECS §2.2): hard-delete soft-deleted rows, then unlink the files
 * they referenced. The rows go first, so a failed unlink leaves an orphaned file
 * rather than a row pointing at nothing.
 */
export async function purgeNow(context: AppContext): Promise<PurgeSummary> {
  const { purgedRows, orphanedFiles } = await purgeDeleted(context.driver);
  let removedFiles = 0;
  for (const path of orphanedFiles) {
    try {
      await context.files.deleteFile('private', path);
      removedFiles += 1;
    } catch (cause) {
      // A file that is already gone is not a reason to fail the purge, but it is
      // never silent (CODESTYLE §6).
      log.warn('purge.file_unlink_failed', {
        directory: EXPORT_PDF_DIRECTORY,
        reason: cause instanceof Error ? cause.name : 'unknown',
      });
    }
  }
  return { purgedRows, removedFiles };
}
