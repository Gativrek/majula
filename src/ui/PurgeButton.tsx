import { useState } from 'react';
import type { AppContext } from '../services/database.ts';
import { countPurgeable, purgeNow } from '../services/items.ts';
import { Icon } from './Icon.tsx';

/**
 * Purge (SPECS §2.2): hard-deletes everything under Deleted, with its files. Irreversible,
 * so it asks first, and it says what it kept back rather than failing silently.
 */

interface PurgeButtonProps {
  context: AppContext;
  onPurged: () => Promise<void>;
}

type Status = { kind: 'info' | 'error'; message: string } | null;

export function PurgeButton({ context, onPurged }: PurgeButtonProps) {
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  async function purge(): Promise<void> {
    const count = await countPurgeable(context);
    if (count === 0) {
      setStatus({ kind: 'info', message: 'Nothing to purge.' });
      return;
    }
    if (!confirm(`Permanently delete ${count} item(s) and their files? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const result = await purgeNow(context);
      await onPurged();
      const kept =
        result.keptReferenced === 0
          ? ''
          : ` Kept ${result.keptReferenced} still used by a routine or past workout.`;
      const message = `Purged ${result.purgedRows} item(s) and ${result.removedFiles} file(s).${kept}`;
      setStatus({ kind: 'info', message });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'an unknown failure';
      setStatus({ kind: 'error', message: `Purge failed: ${reason}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="purge">
      {status === null ? (
        <p class="panel__note purge__note">
          Purge removes these for good, with their PDFs and check-ins.
        </p>
      ) : (
        <p class={status.kind === 'error' ? 'banner banner--error' : 'banner banner--info'}>
          {status.message}
        </p>
      )}
      <button
        type="button"
        class="button button--danger button--wide"
        disabled={busy}
        onClick={() => void purge()}
      >
        <Icon name="trash" size={20} />
        Purge deleted
      </button>
    </div>
  );
}
