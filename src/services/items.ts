/**
 * What the UI is allowed to ask for. Storage errors from the data layer are
 * translated here into something a screen can act on (CODESTYLE §4).
 */

import { countDeleted, purgeDeleted } from '../data/purge.ts';
import type { SearchHit } from '../data/search.ts';
export type { SearchHit } from '../data/search.ts';
export { MARK_END, MARK_START } from '../data/search.ts';
import { searchHits } from '../data/search.ts';
import { listTags, setTags, tagsForItem, tagsForItems } from '../data/tags.ts';
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

/**
 * SPECS §2.2: every module is a filter over one list, not a screen of its own. A category
 * can span several types, as Workouts spans routines, logs and exercises.
 */
export interface ItemFilter {
  types?: readonly ItemType[];
  tag?: string;
}

export async function listItems(context: AppContext, filter: ItemFilter = {}): Promise<Item[]> {
  return context.items.list({
    ...(filter.types === undefined ? {} : { types: filter.types }),
    ...(filter.tag === undefined ? {} : { tag: filter.tag }),
  });
}

/**
 * Global search over title and body (SPECS §2.2). Soft-deleted rows never appear.
 *
 * It takes no filter: a search covers every type whatever category the list is showing,
 * so a word is found wherever it was filed. Each hit says where it matched, for marking.
 */
export async function searchAll(context: AppContext, query: string): Promise<SearchHit[]> {
  return searchHits(context.driver, query);
}

/** The tags of every item in a list, for showing on its rows (SPECS §2.2, The list). */
export async function loadTagsFor(
  context: AppContext,
  items: readonly Item[],
): Promise<Map<string, string[]>> {
  return tagsForItems(
    context.driver,
    items.map((item) => item.id),
  );
}

/** Every tag currently on a live item, for the tag views. */
export async function loadTagCounts(
  context: AppContext,
): Promise<{ tag: string; count: number }[]> {
  return listTags(context.driver);
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

/** The Done fold's Delete all (SPECS §2.2): these rows, in one write, files retained. */
export async function deleteItems(context: AppContext, ids: readonly string[]): Promise<void> {
  await context.items.softDeleteMany(ids);
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
  /** Deleted exercises and routines kept because a surviving workout still uses them. */
  keptReferenced: number;
}

/**
 * The global purge (SPECS §2.2): hard-delete soft-deleted rows, then unlink the files
 * they referenced. The rows go first, so a failed unlink leaves an orphaned file
 * rather than a row pointing at nothing.
 */
export async function purgeNow(context: AppContext): Promise<PurgeSummary> {
  const { purgedRows, orphanedFiles, keptReferenced } = await purgeDeleted(context.driver);
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
  return { purgedRows, removedFiles, keptReferenced };
}
