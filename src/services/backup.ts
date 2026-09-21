/**
 * Export and import (SPECS §5). Required, not optional: ADR-003 keeps everything on
 * one phone, so this is the only thing between the owner and total data loss.
 *
 * GATE E1 closed on a DIRECTORY container: `Majula/majula-export.json` beside a
 * `Majula/pdfs/` directory, in user-accessible storage. No zip, so no new dependency
 * and no new ADR. The `pdfs/` directory is created from Phase 1 even though nothing
 * attaches a PDF until Phase 5, so the container never changes format.
 */

import { restoreTables } from '../data/dump.ts';
import { dumpTables } from '../data/dump.ts';
import type { SqlDriver } from '../data/driver.ts';
import { readSchemaVersion, runMigrations, TARGET_SCHEMA_VERSION } from '../data/migrations.ts';
import { tableColumnsForVersion } from '../data/tables.ts';
import { InvariantError, ValidationError } from '../lib/errors.ts';
import { log } from '../lib/logger.ts';
import type { Clock } from '../lib/time.ts';
import { nowTimestamp, systemClock } from '../lib/time.ts';
import type { FileStore } from './files.ts';
import { EXPORT_DIRECTORY, EXPORT_FILE_NAME, EXPORT_PDF_DIRECTORY } from './files.ts';

/** Identifies the file as ours before anything tries to read it as a database. */
export const EXPORT_FORMAT = 'majula-export';

export interface ExportEnvelope {
  format: typeof EXPORT_FORMAT;
  schema_version: number;
  exported_at: string;
  pdfs_included: boolean;
  tables: Record<string, unknown>;
}

export interface ExportOptions {
  /** SPECS §5: PDFs are included by default; this is the flag that leaves them out. */
  includePdfs?: boolean;
  clock?: Clock;
}

export interface ExportResult {
  path: string;
  schemaVersion: number;
  pdfsIncluded: boolean;
  pdfCount: number;
}

function exportPath(...parts: string[]): string {
  return [EXPORT_DIRECTORY, ...parts].join('/');
}

async function copyAttachedPdfs(files: FileStore): Promise<number> {
  const source = EXPORT_PDF_DIRECTORY;
  if (!(await files.exists('private', source))) {
    log.info('export.no_pdf_directory', {});
    return 0;
  }
  const names = await files.listDirectory('private', source);
  for (const name of names) {
    await files.copyFile(
      { root: 'private', path: `${source}/${name}` },
      { root: 'export', path: exportPath(EXPORT_PDF_DIRECTORY, name) },
    );
  }
  return names.length;
}

/**
 * Write the full export container to user-accessible storage.
 *
 * @returns where it was written and what went into it.
 */
export async function exportDatabase(
  driver: SqlDriver,
  files: FileStore,
  options: ExportOptions = {},
): Promise<ExportResult> {
  const includePdfs = options.includePdfs ?? true;
  const clock = options.clock ?? systemClock;

  const schemaVersion = await readSchemaVersion(driver);
  const columns = tableColumnsForVersion(schemaVersion);
  if (columns === null) {
    throw new InvariantError(`no table registry for schema_version ${schemaVersion}`);
  }

  await files.ensureDirectory('export', EXPORT_DIRECTORY);
  await files.ensureDirectory('export', exportPath(EXPORT_PDF_DIRECTORY));

  const envelope: ExportEnvelope = {
    format: EXPORT_FORMAT,
    schema_version: schemaVersion,
    exported_at: nowTimestamp(clock),
    pdfs_included: includePdfs,
    tables: await dumpTables(driver, columns),
  };

  await files.writeText('export', exportPath(EXPORT_FILE_NAME), JSON.stringify(envelope));

  const pdfCount = includePdfs ? await copyAttachedPdfs(files) : 0;
  log.info('export.done', { schemaVersion, pdfsIncluded: includePdfs, pdfCount });

  return {
    path: exportPath(EXPORT_FILE_NAME),
    schemaVersion,
    pdfsIncluded: includePdfs,
    pdfCount,
  };
}

/**
 * Validate an export file's envelope. An import is untrusted input (CODESTYLE §9).
 *
 * @throws {ValidationError} when the file is not an export of a version this build
 * can read.
 */
export function parseEnvelope(text: string): ExportEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new ValidationError('export file is not valid JSON', { subject: 'import' }, { cause });
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError('export file is not an object', { subject: 'import' });
  }
  const raw = parsed as Record<string, unknown>;
  if (raw.format !== EXPORT_FORMAT) {
    throw new ValidationError(`not a ${EXPORT_FORMAT} file`, { subject: 'import' });
  }
  if (typeof raw.schema_version !== 'number' || !Number.isInteger(raw.schema_version)) {
    throw new ValidationError('export file has no integer schema_version', { subject: 'import' });
  }
  if (typeof raw.tables !== 'object' || raw.tables === null || Array.isArray(raw.tables)) {
    throw new ValidationError('export file has no tables object', { subject: 'import' });
  }
  return {
    format: EXPORT_FORMAT,
    schema_version: raw.schema_version,
    exported_at: typeof raw.exported_at === 'string' ? raw.exported_at : '',
    pdfs_included: raw.pdfs_included === true,
    tables: raw.tables as Record<string, unknown>,
  };
}

export interface ImportResult {
  fromSchemaVersion: number;
  toSchemaVersion: number;
  restoredRows: number;
  restoredPdfs: number;
}

async function restoreAttachedPdfs(files: FileStore): Promise<number> {
  const source = exportPath(EXPORT_PDF_DIRECTORY);
  if (!(await files.exists('export', source))) {
    log.info('import.no_pdf_directory', {});
    return 0;
  }
  const names = await files.listDirectory('export', source);
  await files.ensureDirectory('private', EXPORT_PDF_DIRECTORY);
  for (const name of names) {
    await files.copyFile(
      { root: 'export', path: `${source}/${name}` },
      { root: 'private', path: `${EXPORT_PDF_DIRECTORY}/${name}` },
    );
  }
  return names.length;
}

/**
 * Replace the database with the contents of the export container.
 *
 * Refuses an export written by a newer build, and migrates an older one forward
 * after restoring it at its own version (SPECS §5).
 *
 * @throws {InvariantError} when the export is ahead of this build.
 */
export async function importDatabase(driver: SqlDriver, files: FileStore): Promise<ImportResult> {
  const text = await files.readText('export', exportPath(EXPORT_FILE_NAME));
  const envelope = parseEnvelope(text);

  if (envelope.schema_version > TARGET_SCHEMA_VERSION) {
    log.error('import.refused_newer', {
      from: envelope.schema_version,
      target: TARGET_SCHEMA_VERSION,
    });
    throw new InvariantError(
      `export schema_version ${envelope.schema_version} is newer than this build ` +
        `(${TARGET_SCHEMA_VERSION})`,
    );
  }

  const columns = tableColumnsForVersion(envelope.schema_version);
  if (columns === null) {
    throw new ValidationError(`no table registry for schema_version ${envelope.schema_version}`, {
      subject: 'import',
    });
  }

  const restoredRows = await restoreTables(driver, columns, envelope.tables);

  // The rows landed in the shape their own version defined, so the migration runner
  // carries them forward from there rather than from wherever this database was.
  await driver.run('UPDATE schema_version SET version = ? WHERE id = 1', [envelope.schema_version]);
  const toSchemaVersion = await runMigrations(driver);

  const restoredPdfs = envelope.pdfs_included ? await restoreAttachedPdfs(files) : 0;
  if (!envelope.pdfs_included) {
    log.info('import.data_only_export', {});
  }

  log.info('import.done', {
    from: envelope.schema_version,
    to: toSchemaVersion,
    rows: restoredRows,
    pdfs: restoredPdfs,
  });

  return {
    fromSchemaVersion: envelope.schema_version,
    toSchemaVersion,
    restoredRows,
    restoredPdfs,
  };
}
