import { useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import { formatCoordinates, geoLink, parseCoordinates } from '../services/coordinates.ts';
import type { Fix } from '../services/location.ts';
import type { PlaceResult } from '../services/places.ts';

/**
 * A place (`docs/modules/places.md`): its name and note, and its coordinates — taken from
 * here, pasted from a maps app, or cleared. No map is drawn; **Open in maps** hands the
 * place to the device's own maps app.
 */

interface PlaceDetailProps {
  place: ItemOfType<'place'>;
  onSaveDetails: (details: { name: string; note: string }) => Promise<PlaceResult>;
  onLocate: () => Promise<Fix>;
  onSetCoordinates: (coordinates: { lat: number; lon: number }) => Promise<void>;
  onClearCoordinates: () => Promise<void>;
  onClose: () => void;
}

type Message = { kind: 'info' | 'error'; text: string } | null;

export function PlaceDetail({
  place,
  onSaveDetails,
  onLocate,
  onSetCoordinates,
  onClearCoordinates,
  onClose,
}: PlaceDetailProps) {
  const [name, setName] = useState(place.title);
  const [note, setNote] = useState(place.body ?? '');
  const [pasted, setPasted] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);

  const { lat, lon } = place.payload;
  const hasCoordinates = lat !== undefined && lon !== undefined;
  const isDirty = name !== place.title || note !== (place.body ?? '');

  async function run(work: () => Promise<Message>): Promise<void> {
    setBusy(true);
    try {
      setMessage(await work());
    } catch (error) {
      setMessage({
        kind: 'error',
        text: `That failed: ${error instanceof Error ? error.message : 'unknown failure'}.`,
      });
    } finally {
      setBusy(false);
    }
  }

  function saveDetails(): Promise<void> {
    return run(async function save() {
      const result = await onSaveDetails({ name, note });
      return result.ok ? { kind: 'info', text: 'Saved.' } : { kind: 'error', text: result.message };
    });
  }

  function locate(): Promise<void> {
    setMessage({ kind: 'info', text: 'Locating… without signal the first fix can take a while.' });
    return run(async function useHere() {
      const fix = await onLocate();
      if (!fix.ok) return { kind: 'error', text: fix.message };
      await onSetCoordinates({ lat: fix.lat, lon: fix.lon });
      // places.md criterion 6: the accuracy shows an approximate-only grant for what it is.
      return { kind: 'info', text: `Location set, accurate to about ${fix.accuracyMetres} m.` };
    });
  }

  function setFromPaste(): Promise<void> {
    return run(async function usePasted() {
      const parsed = parseCoordinates(pasted);
      if (!parsed.ok) return { kind: 'error', text: parsed.message };
      await onSetCoordinates({ lat: parsed.lat, lon: parsed.lon });
      setPasted('');
      return { kind: 'info', text: 'Location set.' };
    });
  }

  function clear(): Promise<void> {
    return run(async function clearCoordinates() {
      await onClearCoordinates();
      return { kind: 'info', text: 'Location cleared.' };
    });
  }

  return (
    <div class="kitchen kitchen--editing">
      <main class="kitchen__body editor">
        <label class="editor__field">
          <span class="editor__label">Name</span>
          <input
            class="capture__input"
            type="text"
            value={name}
            onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)}
          />
        </label>

        <label class="editor__field">
          <span class="editor__label">Note</span>
          <textarea
            class="capture__input editor__step-text"
            rows={3}
            value={note}
            placeholder="Optional"
            onInput={(event) => setNote((event.currentTarget as HTMLTextAreaElement).value)}
          />
        </label>

        <button
          type="button"
          class="button button--quiet"
          disabled={busy || !isDirty}
          onClick={() => void saveDetails()}
        >
          Save name and note
        </button>

        <section class="kitchen__section place__location">
          <h3 class="kitchen__heading">Location</h3>
          {hasCoordinates ? (
            <>
              <p class="place__coordinates">{formatCoordinates(lat, lon)}</p>
              <div class="panel__row">
                <a class="button" href={geoLink(lat, lon, place.title)}>
                  Open in maps
                </a>
                <button
                  type="button"
                  class="button button--quiet"
                  disabled={busy}
                  onClick={() => void clear()}
                >
                  Clear
                </button>
              </div>
            </>
          ) : (
            <p class="panel__note">No location yet.</p>
          )}

          <button
            type="button"
            class="button place__here"
            disabled={busy}
            onClick={() => void locate()}
          >
            {hasCoordinates ? 'Replace with here' : 'Here'}
          </button>

          <div class="capture">
            <input
              class="capture__input"
              type="text"
              inputMode="text"
              autoComplete="off"
              value={pasted}
              placeholder="-12.3400, -56.0000"
              aria-label="Coordinates to paste"
              onInput={(event) => setPasted((event.currentTarget as HTMLInputElement).value)}
            />
            <button
              type="button"
              class="button button--quiet"
              disabled={busy || pasted.trim().length === 0}
              onClick={() => void setFromPaste()}
            >
              Set
            </button>
          </div>
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
