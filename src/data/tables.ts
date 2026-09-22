/**
 * The table and column registry the export writer and the import reader work from.
 *
 * Column names cannot come from the data: parameterised queries only, including for
 * table and column names (CODESTYLE §10). So the shape of every schema version is
 * declared here, and an import at a version this build has no entry for is refused
 * rather than guessed at.
 *
 * `schema_version` itself is not exported as a table; it travels in the envelope.
 */

export type TableColumns = Readonly<Record<string, readonly string[]>>;

const VERSION_1: TableColumns = {
  items: [
    'id',
    'type',
    'title',
    'body',
    'url',
    'done',
    'payload',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  tags: ['item_id', 'tag'],
};

// Version 2 adds `items_fts`, which is derived from `items` and rebuilt by its triggers
// on restore. Exporting an index would be exporting the same text twice.
const VERSION_2: TableColumns = VERSION_1;

export const TABLE_COLUMNS_BY_VERSION: Readonly<Record<number, TableColumns>> = {
  1: VERSION_1,
  2: VERSION_2,
};

export function tableColumnsForVersion(version: number): TableColumns | null {
  return TABLE_COLUMNS_BY_VERSION[version] ?? null;
}

/**
 * The order tables must be written in so foreign keys resolve: `tags` references
 * `items`, and `PRAGMA foreign_keys = ON` means that ordering is enforced.
 */
export function insertionOrder(columns: TableColumns): string[] {
  const names = Object.keys(columns);
  const priority = ['items'];
  return [
    ...priority.filter((name) => names.includes(name)),
    ...names.filter((name) => !priority.includes(name)),
  ];
}
