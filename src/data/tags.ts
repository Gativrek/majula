/**
 * The `tags` table (SPECS §4.2). Tag views are saved filters over `items`, so there
 * is no per-module storage here and never will be (SPECS §2.2).
 */

import type { SqlDriver } from './driver.ts';

/**
 * Replace an item's tags. Runs in a transaction so a half-applied set never lands
 * (CODESTYLE §7).
 *
 * Tags are stored exactly as typed: user content is never case-folded on the way in
 * (CODESTYLE §1).
 */
export async function setTags(
  driver: SqlDriver,
  itemId: string,
  tags: readonly string[],
): Promise<void> {
  const unique = [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))];
  await driver.transaction(async function replaceTags() {
    await driver.run('DELETE FROM tags WHERE item_id = ?', [itemId]);
    for (const tag of unique) {
      await driver.run('INSERT INTO tags (item_id, tag) VALUES (?, ?)', [itemId, tag]);
    }
  });
}

export async function tagsForItem(driver: SqlDriver, itemId: string): Promise<string[]> {
  const rows = await driver.query<{ tag: string }>(
    'SELECT tag FROM tags WHERE item_id = ? ORDER BY tag',
    [itemId],
  );
  return rows.map((row) => row.tag);
}

/** Every tag in use on a live item, with how many live items carry it. */
export async function listTags(driver: SqlDriver): Promise<{ tag: string; count: number }[]> {
  return driver.query<{ tag: string; count: number }>(
    'SELECT tags.tag AS tag, COUNT(*) AS count FROM tags ' +
      'JOIN items ON items.id = tags.item_id ' +
      'WHERE items.deleted_at IS NULL ' +
      'GROUP BY tags.tag ORDER BY tags.tag',
  );
}

/** Ids per query: well under SQLite's bound-parameter limit on any build. */
const IDS_PER_QUERY = 500;

/**
 * The tags of many items in a few queries rather than one per row, for showing tags on a
 * list (SPECS §2.2, The list). Items with no tags are absent from the map.
 */
export async function tagsForItems(
  driver: SqlDriver,
  itemIds: readonly string[],
): Promise<Map<string, string[]>> {
  const byItem = new Map<string, string[]>();
  for (let start = 0; start < itemIds.length; start += IDS_PER_QUERY) {
    const ids = itemIds.slice(start, start + IDS_PER_QUERY);
    // One placeholder per id: the values are bound, never interpolated (CODESTYLE §10).
    const rows = await driver.query<{ item_id: string; tag: string }>(
      `SELECT item_id, tag FROM tags WHERE item_id IN (${ids.map(() => '?').join(', ')}) ` +
        'ORDER BY tag',
      ids,
    );
    for (const row of rows) {
      const tags = byItem.get(row.item_id) ?? [];
      tags.push(row.tag);
      byItem.set(row.item_id, tags);
    }
  }
  return byItem;
}
