import { useState } from 'react';
import type { AppContext } from '../services/database.ts';
import { exportDatabase, importDatabase } from '../services/backup.ts';
import { EXPORT_DIRECTORY, EXPORT_FILE_NAME } from '../services/files.ts';
import { Icon } from './Icon.tsx';

/**
 * Export and import (SPECS §5). Purge sits under Deleted (`PurgeButton`).
 *
 * Import replaces the database rather than merging into it, so it asks first. A failure
 * says what failed and what to do about it, and never prints a stack trace (CODESTYLE §7).
 */

interface BackupPanelProps {
  context: AppContext;
  onDataChanged: () => Promise<void>;
}

type Status = { kind: 'info' | 'error'; message: string } | null;

function describeFailure(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'an unknown failure';
}

export function BackupPanel({ context, onDataChanged }: BackupPanelProps) {
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  async function run(label: string, work: () => Promise<string>): Promise<void> {
    setBusy(true);
    setStatus(null);
    try {
      setStatus({ kind: 'info', message: await work() });
    } catch (error) {
      setStatus({ kind: 'error', message: `${label} failed: ${describeFailure(error)}` });
    } finally {
      setBusy(false);
    }
  }

  async function onExport(includePdfs: boolean): Promise<void> {
    await run('Export', async function exportNow() {
      const result = await exportDatabase(context.driver, context.files, { includePdfs });
      const pdfs = includePdfs ? `, ${result.pdfCount} PDF(s)` : ', data only';
      return `Exported to ${result.path} (schema v${result.schemaVersion}${pdfs}).`;
    });
  }

  async function onImport(): Promise<void> {
    const confirmed = confirm(
      `Import replaces everything currently on this phone with ` +
        `${EXPORT_DIRECTORY}/${EXPORT_FILE_NAME}. It does not merge. Continue?`,
    );
    if (!confirmed) return;
    await run('Import', async function importNow() {
      const result = await importDatabase(context.driver, context.files);
      await onDataChanged();
      return (
        `Imported ${result.restoredRows} row(s) from schema v${result.fromSchemaVersion}, ` +
        `now at v${result.toSchemaVersion}.`
      );
    });
  }

  return (
    <div class="panel">
      <section class="card">
        <div class="card__row">
          <span class="tile tile--accent">
            <Icon name="backup" />
          </span>
          <span class="row__text">
            <span class="row__title">Export</span>
            <span class="row__meta row__meta--wrap">
              {`Documents/${EXPORT_DIRECTORY}/${EXPORT_FILE_NAME}`}, beside a <code>pdfs/</code>{' '}
              folder
            </span>
          </span>
        </div>
        <p class="card__note">
          <Icon name="shield" size={16} />
          Nothing leaves this phone. Losing it loses the data unless it has been exported.
        </p>
        <div class="button-row">
          <button class="button" type="button" disabled={busy} onClick={() => void onExport(true)}>
            Export
          </button>
          <button
            class="button button--quiet"
            type="button"
            disabled={busy}
            onClick={() => void onExport(false)}
          >
            Without PDFs
          </button>
        </div>
      </section>

      <section class="card">
        <div class="card__row">
          <span class="tile">
            <Icon name="restore" />
          </span>
          <span class="row__text">
            <span class="row__title">Import</span>
            <span class="row__meta row__meta--wrap">
              Replaces everything on this phone with the export. It does not merge.
            </span>
          </span>
        </div>
        <button
          class="button button--outline"
          type="button"
          disabled={busy}
          onClick={() => void onImport()}
        >
          Import
        </button>
      </section>

      {status === null ? null : (
        <p class={status.kind === 'error' ? 'banner banner--error' : 'banner banner--info'}>
          {status.message}
        </p>
      )}
    </div>
  );
}
