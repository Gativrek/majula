/**
 * Opening the database once and bringing it up to date.
 *
 * The UI calls {@link initialiseApp} and gets back everything it is allowed to touch.
 * It never sees the driver (CODESTYLE §4).
 */

import { openDeviceDatabase } from '../data/driver-capacitor.ts';
import type { SqlDriver } from '../data/driver.ts';
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
 * Which part of startup failed. The UI needs this to say something true: a migration
 * that fails on the device is not the same fault as SQLite being absent, and an earlier
 * version of this screen reported both as "could not open its database" and blamed the
 * browser — which sent a real migration bug looking in the wrong place entirely.
 */
export type StartupStage = 'open' | 'migrate' | 'files';

export class StartupError extends Error {
  override readonly name = 'StartupError';
  readonly stage: StartupStage;

  constructor(stage: StartupStage, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.stage = stage;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'an unknown failure';
}

async function stage<T>(name: StartupStage, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    log.error('app.startup_stage_failed', { stage: name, reason: describe(cause) });
    throw new StartupError(name, describe(cause), { cause });
  }
}

/**
 * Open the database, migrate it, and cache the result for the rest of the session.
 *
 * @throws {StartupError} naming the stage that failed. `open` is what a desktop browser
 * produces, since SQLite is a native plugin; `migrate` means the schema is the problem,
 * not the platform.
 */
export async function initialiseApp(): Promise<AppContext> {
  if (context !== null) return context;

  const driver = await stage('open', openDeviceDatabase);
  const schemaVersion = await stage('migrate', function migrate() {
    return runMigrations(driver);
  });
  const files = await stage('files', createDeviceFileStore);

  log.info('app.initialised', { schemaVersion, commit: __COMMIT_HASH__ });
  context = { driver, items: new ItemStore(driver), files, schemaVersion };
  return context;
}

/** For tests and for the import path, which swaps the whole database underneath. */
export function setAppContext(next: AppContext | null): void {
  context = next;
}
