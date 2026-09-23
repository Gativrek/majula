import { useRef, useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import type { AttachResult, DetailsResult } from '../services/reading.ts';

/**
 * A reading-queue entry (`docs/modules/reading-queue.md` criteria 2–9): title and URL,
 * and the PDF — attached from the system picker, or opened if already there.
 */

interface ReadingDetailProps {
  reading: ItemOfType<'reading'>;
  onSaveDetails: (details: { title: string; url: string }) => Promise<DetailsResult>;
  onAttach: (bytes: Uint8Array) => Promise<AttachResult>;
  onOpenPdf: () => void;
  onClose: () => void;
}

/** Only an http(s) address is offered as a link; anything else is shown as typed. */
function openableUrl(url: string | null): string | null {
  if (url === null) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function pdfSummary(reading: ItemOfType<'reading'>): string {
  const { page_count: pages, last_page: lastPage } = reading.payload;
  if (pages === undefined) return 'PDF attached';
  if (lastPage === undefined || lastPage <= 1) return `${pages} page${pages === 1 ? '' : 's'}`;
  return `Page ${lastPage} of ${pages}`;
}

export function ReadingDetail({
  reading,
  onSaveDetails,
  onAttach,
  onOpenPdf,
  onClose,
}: ReadingDetailProps) {
  const [title, setTitle] = useState(reading.title);
  const [url, setUrl] = useState(reading.url ?? '');
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement | null>(null);

  const hasPdf = reading.payload.pdf_path !== undefined;
  const link = openableUrl(reading.url);
  const isDirty = title !== reading.title || url !== (reading.url ?? '');

  async function saveDetails(): Promise<void> {
    setBusy(true);
    try {
      const result = await onSaveDetails({ title, url });
      setMessage(
        result.ok ? { kind: 'info', text: 'Saved.' } : { kind: 'error', text: result.message },
      );
    } finally {
      setBusy(false);
    }
  }

  async function onPicked(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so picking the same file again after a refusal still fires a change.
    input.value = '';
    if (file === undefined) return;
    setBusy(true);
    setMessage({ kind: 'info', text: 'Copying the PDF into Majula…' });
    try {
      const result = await onAttach(new Uint8Array(await file.arrayBuffer()));
      setMessage(
        result.ok
          ? { kind: 'info', text: 'Attached. The original can now be moved or deleted.' }
          : { kind: 'error', text: result.message },
      );
    } catch (error) {
      setMessage({
        kind: 'error',
        text: `Attaching failed: ${error instanceof Error ? error.message : 'unknown failure'}.`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="kitchen kitchen--editing">
      <main class="kitchen__body editor">
        <label class="editor__field">
          <span class="editor__label">Title</span>
          <input
            class="capture__input"
            type="text"
            value={title}
            onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)}
          />
        </label>

        <label class="editor__field">
          <span class="editor__label">URL</span>
          <input
            class="capture__input"
            type="url"
            inputMode="url"
            autoComplete="off"
            value={url}
            placeholder="Optional"
            onInput={(event) => setUrl((event.currentTarget as HTMLInputElement).value)}
          />
        </label>
        {link === null ? null : (
          <p class="panel__note">
            <a class="reading__link" href={link} target="_blank" rel="noreferrer">
              Open in browser
            </a>
          </p>
        )}

        <button
          type="button"
          class="button button--quiet"
          disabled={busy || !isDirty}
          onClick={() => void saveDetails()}
        >
          Save title and URL
        </button>

        <section class="kitchen__section reading__pdf">
          <h3 class="kitchen__heading">PDF</h3>
          {hasPdf ? (
            <>
              <p class="panel__note">{pdfSummary(reading)}</p>
              <button type="button" class="button" disabled={busy} onClick={onOpenPdf}>
                Open PDF
              </button>
            </>
          ) : (
            <>
              <p class="panel__note">
                Attaching copies the file into Majula, so the original can be moved or deleted
                afterwards.
              </p>
              <button
                type="button"
                class="button"
                disabled={busy}
                onClick={() => picker.current?.click()}
              >
                Attach PDF
              </button>
              <input
                ref={picker}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(event) => void onPicked(event)}
              />
            </>
          )}
        </section>

        {message === null ? null : (
          <p class={message.kind === 'error' ? 'banner banner--error' : 'banner banner--info'}>
            {message.text}
          </p>
        )}
      </main>

      <footer class="kitchen__actions">
        <button type="button" class="button button--quiet" onClick={onClose}>
          Close
        </button>
      </footer>
    </div>
  );
}
