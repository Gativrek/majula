import { useRef, useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import type { AttachResult, DetailsResult } from '../services/reading.ts';
import { Icon } from './Icon.tsx';
import { ModuleHeader } from './ModuleHeader.tsx';
import { PdfCard } from './PdfCard.tsx';
import { useBackStep } from './use-back-step.ts';

/**
 * A reading-queue entry (`docs/modules/reading-queue.md` criteria 2–9). It opens to be
 * read, not edited: the title and link, then the PDF with where reading stopped. The
 * pencil turns the title and link into fields; back cancels that edit.
 *
 * The main action sits at the bottom under the thumb: continue reading, or attach a PDF
 * when there is none. The read status is the square beside it.
 */

interface ReadingDetailProps {
  reading: ItemOfType<'reading'>;
  onSaveDetails: (details: { title: string; url: string }) => Promise<DetailsResult>;
  onAttach: (bytes: Uint8Array) => Promise<AttachResult>;
  onToggleRead: () => Promise<void>;
  onOpenPdf: () => void;
  onClose: () => void;
}

type Message = { kind: 'info' | 'error'; text: string } | null;

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

/** The address without its scheme, which is noise on a phone screen. */
function shownUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function continueLabel(lastPage: number | undefined): string {
  return lastPage === undefined || lastPage <= 1 ? 'Open PDF' : `Continue on page ${lastPage}`;
}

export function ReadingDetail(props: ReadingDetailProps) {
  const { reading } = props;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(reading.title);
  const [url, setUrl] = useState(reading.url ?? '');
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement | null>(null);

  // SPECS §2.2, Back: an edit in progress is cancelled, never saved.
  useBackStep(editing, cancelEdit);

  const hasPdf = reading.payload.pdf_path !== undefined;
  const link = openableUrl(reading.url);
  const isDirty = title !== reading.title || url !== (reading.url ?? '');

  function cancelEdit(): void {
    setTitle(reading.title);
    setUrl(reading.url ?? '');
    setEditing(false);
  }

  async function saveDetails(): Promise<void> {
    setBusy(true);
    try {
      const result = await props.onSaveDetails({ title, url });
      if (result.ok) {
        setEditing(false);
        setMessage(null);
      } else {
        setMessage({ kind: 'error', text: result.message });
      }
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
      const result = await props.onAttach(new Uint8Array(await file.arrayBuffer()));
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
      <ModuleHeader
        icon="reading"
        label="Reading"
        onBack={props.onClose}
        edit={{
          editing,
          label: 'Edit title and link',
          onToggle: () => (editing ? cancelEdit() : setEditing(true)),
        }}
      />

      <main class="kitchen__body editor">
        {editing ? (
          <>
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
            <button
              type="button"
              class="button"
              disabled={busy || !isDirty}
              onClick={() => void saveDetails()}
            >
              Save title and link
            </button>
          </>
        ) : (
          <div class="kitchen__heading-block">
            <h2 class="module-title">{reading.title}</h2>
            {link === null ? (
              reading.url === null ? null : (
                <p class="panel__note">{reading.url}</p>
              )
            ) : (
              <a class="link-row" href={link} target="_blank" rel="noreferrer">
                <Icon name="link" size={18} />
                <span>{shownUrl(link)}</span>
              </a>
            )}
          </div>
        )}

        {hasPdf ? (
          <PdfCard reading={reading} />
        ) : (
          <p class="panel__note">
            No PDF yet. Attaching copies the file into Majula, so the original can be moved or
            deleted afterwards.
          </p>
        )}

        {message === null ? null : (
          <p class={message.kind === 'error' ? 'banner banner--error' : 'banner banner--info'}>
            {message.text}
          </p>
        )}
      </main>

      <footer class="kitchen__actions">
        <button
          type="button"
          class="button button--quiet button--square"
          aria-pressed={reading.done}
          aria-label={reading.done ? 'Mark as unread' : 'Mark as read'}
          onClick={() => void props.onToggleRead()}
        >
          <Icon name="check" />
        </button>
        {hasPdf ? (
          <button type="button" class="button" disabled={busy} onClick={props.onOpenPdf}>
            <Icon name="reading" size={20} />
            {continueLabel(reading.payload.last_page)}
          </button>
        ) : (
          <button
            type="button"
            class="button"
            disabled={busy}
            onClick={() => picker.current?.click()}
          >
            <Icon name="file" size={20} />
            Attach PDF
          </button>
        )}
        <input
          ref={picker}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(event) => void onPicked(event)}
        />
      </footer>
    </div>
  );
}
