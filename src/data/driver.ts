/**
 * The narrow SQL surface the rest of the data layer is written against.
 *
 * There are exactly two implementations: the Capacitor plugin on the device, and
 * `node:sqlite` under `node --test`. The interface exists so migrations, the item
 * store and the export writer can be tested without an Android device — not to
 * leave room for a third backend (SPECS §1.1 item 3).
 */

export type SqlValue = string | number | null;

export interface SqlDriver {
  /** Run one or more statements with no parameters. For DDL and pragmas only. */
  executeScript(sql: string): Promise<void>;

  /** Run a single parameterised statement that returns no rows. */
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;

  /** Run a single parameterised statement and return its rows. */
  query<Row>(sql: string, params?: readonly SqlValue[]): Promise<Row[]>;

  /**
   * Run `work` inside a transaction, rolling back if it throws. A failed write
   * leaves the database unchanged (CODESTYLE §7).
   */
  transaction<T>(work: () => Promise<T>): Promise<T>;

  close(): Promise<void>;
}

/** Convenience for the many queries that expect at most one row. */
export async function queryOne<Row>(
  driver: SqlDriver,
  sql: string,
  params?: readonly SqlValue[],
): Promise<Row | null> {
  const rows = await driver.query<Row>(sql, params);
  return rows[0] ?? null;
}
