import { useState } from 'react';
import type { AppContext } from '../services/database.ts';
import { exportDatabase, importDatabase } from '../services/backup.ts';
import { EXPORT_DIRECTORY, EXPORT_FILE_NAME } from '../services/files.ts';
import { countPurgeable, purgeNow } from '../services/items.ts';

/**
 * Export, import and purge (SPECS §5, §2.2).
 *
 * Import replaces the database rather than merging into it, and purge is
 * irreversible, so both ask first. A failure says what failed and what to do about
 * it, and never prints a stack trace (CODESTYLE §7).
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

  async function onPurge(): Promise<void> {
    const count = await countPurgeable(context);
    if (count === 0) {
      setStatus({ kind: 'info', message: 'Nothing to purge.' });
      return;
    }
    if (!confirm(`Permanently delete ${count} item(s) and their files? This cannot be undone.`)) {
      return;
    }
    await run('Purge', async function purge() {
      const result = await purgeNow(context);
      await onDataChanged();
      return `Purged ${result.purgedRows} item(s) and ${result.removedFiles} file(s).`;
    });
  }

  return (
    <div class="panel">
      <p class="panel__note">
        Nothing leaves this phone, so losing the phone loses the data unless it has been exported.
        The export is a directory:{' '}
        <code>
          {EXPORT_DIRECTORY}/{EXPORT_FILE_NAME}
        </code>{' '}
        beside a <code>pdfs/</code> directory.
      </p>

      <div class="panel__row">
        <button class="button" type="button" disabled={busy} onClick={() => void onExport(true)}>
          Export
        </button>
        <button
          class="button button--quiet"
          type="button"
          disabled={busy}
          onClick={() => void onExport(false)}
        >
          Export without PDFs
        </button>
      </div>

      <div class="panel__row">
        <button
          class="button button--quiet"
          type="button"
          disabled={busy}
          onClick={() => void onImport()}
        >
          Import (replaces everything)
        </button>
        <button
          class="button button--danger"
          type="button"
          disabled={busy}
          onClick={() => void onPurge()}
        >
          Purge deleted
        </button>
      </div>

      {status === null ? null : (
        <p class={status.kind === 'error' ? 'banner banner--error' : 'banner banner--info'}>
          {status.message}
        </p>
      )}
    </div>
  );
}
