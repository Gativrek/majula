/**
 * Opening the database once and bringing it up to date.
 *
 * The UI calls {@link initialiseApp} and gets back everything it is allowed to touch.
 * It never sees the driver (CODESTYLE §4).
 */

import { openDeviceDatabase } from '../data/driver-capacitor.ts';
import type { SqlDriver } from '../data/driver.ts';
import { probeFts5 } from '../data/fts-probe.ts';
import { ItemStore } from '../data/items.ts';
import { runMigrations } from '../data/migrations.ts';
import { log } from '../lib/logger.ts';
import type { FileStore } from './files.ts';
import { createDeviceFileStore } from './files.ts';

export interface AppContext {
  driver: SqlDriver;
  items: ItemStore;
  files: FileStore;
  schemaVersion: number;
}

let context: AppContext | null = null;

/**
 * Open the database, migrate it, and cache the result for the rest of the session.
 *
 * @throws {StorageError} when SQLite is unavailable, which is what a desktop browser
 * does. That is not worked around: acceptance runs on a device (SPECS §6).
 */
export async function initialiseApp(): Promise<AppContext> {
  if (context !== null) return context;

  const driver = await openDeviceDatabase();
  const schemaVersion = await runMigrations(driver);
  const files = await createDeviceFileStore();

  // GATE V1: answers ADR-002's open question on the device it actually has to hold for.
  // Remove this call, and src/data/fts-probe.ts, once the gate is closed.
  await probeFts5(driver);

  log.info('app.initialised', { schemaVersion, commit: __COMMIT_HASH__ });
  context = { driver, items: new ItemStore(driver), files, schemaVersion };
  return context;
}

/** For tests and for the import path, which swaps the whole database underneath. */
export function setAppContext(next: AppContext | null): void {
  context = next;
}
