import { useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import { geoLink, parseCoordinates } from '../services/coordinates.ts';
import type { Fix } from '../services/location.ts';
import type { Coordinates } from '../services/maps-link.ts';
import { coordinatesFromMapsLink, findMapsLink, isMapsLink } from '../services/maps-link.ts';
import type { PlaceResult } from '../services/places.ts';
import { Icon } from './Icon.tsx';
import { ModuleHeader } from './ModuleHeader.tsx';
import { LocationCard } from './LocationCard.tsx';
import { useBackStep } from './use-back-step.ts';

/**
 * A place (`docs/modules/places.md`): its name and note, its coordinates — taken from
 * here, or pasted — and a Google Maps link, shared or pasted. No map is drawn; **Open in
 * maps** hands the listing, or else the coordinates, to the device's own maps app.
 */

interface PlaceDetailProps {
  place: ItemOfType<'place'>;
  onSaveDetails: (details: { name: string; note: string }) => Promise<PlaceResult>;
  onLocate: () => Promise<Fix>;
  onSetCoordinates: (coordinates: { lat: number; lon: number }) => Promise<void>;
  onSetLink: (link: { url: string; coordinates: Coordinates | null }) => Promise<void>;
  onClearCoordinates: () => Promise<void>;
  onClose: () => void;
}

type Message = { kind: 'info' | 'error'; text: string } | null;

export function PlaceDetail({
  place,
  onSaveDetails,
  onLocate,
  onSetCoordinates,
  onSetLink,
  onClearCoordinates,
  onClose,
}: PlaceDetailProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(place.title);
  const [note, setNote] = useState(place.body ?? '');
  const [pasted, setPasted] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);

  // SPECS §2.2, Back: an edit in progress is cancelled, never saved.
  useBackStep(editing, cancelEdit);

  const { lat, lon } = place.payload;
  const hasCoordinates = lat !== undefined && lon !== undefined;
  // Re-checked on render: a stored url may have come from an import, not from this screen.
  const mapsUrl = place.url !== null && isMapsLink(place.url) ? place.url : null;
  // places.md 20: the listing when there is one — reviews, hours — else the coordinates.
  const openHref = mapsUrl ?? (hasCoordinates ? geoLink(lat, lon, place.title) : null);
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

  function cancelEdit(): void {
    setName(place.title);
    setNote(place.body ?? '');
    setEditing(false);
  }

  function saveDetails(): Promise<void> {
    return run(async function save() {
      const result = await onSaveDetails({ name, note });
      if (!result.ok) return { kind: 'error', text: result.message };
      setEditing(false);
      return null;
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
      const link = findMapsLink(pasted);
      if (link !== null) {
        const coordinates = coordinatesFromMapsLink(link);
        await onSetLink({ url: link, coordinates });
        setPasted('');
        return {
          kind: 'info',
          text:
            coordinates === null
              ? 'Maps link kept. Open in maps opens the listing.'
              : 'Maps link kept, with the coordinates it contains.',
        };
      }
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

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ kind: 'info', text: 'Coordinates copied.' });
    } catch {
      setMessage({ kind: 'error', text: 'Could not copy. Select the coordinates instead.' });
    }
  }

  return (
    <div class="kitchen kitchen--editing">
      <ModuleHeader
        icon="place"
        label="Place"
        onBack={onClose}
        edit={{
          editing,
          label: 'Edit name and note',
          onToggle: () => (editing ? cancelEdit() : setEditing(true)),
        }}
      />

      <main class="kitchen__body editor">
        {editing ? (
          <>
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
              class="button"
              disabled={busy || !isDirty}
              onClick={() => void saveDetails()}
            >
              Save name and note
            </button>
          </>
        ) : (
          <div class="kitchen__heading-block">
            <h2 class="module-title">{place.title}</h2>
            {place.body === null ? null : <p class="module-body">{place.body}</p>}
          </div>
        )}

        <LocationCard
          lat={lat}
          lon={lon}
          hasListing={mapsUrl !== null}
          busy={busy}
          onClear={() => void clear()}
          onCopy={(text) => void copy(text)}
        />

        <section class="kitchen__section">
          <label class="kitchen__heading" for="place-paste">
            Paste coordinates or a Maps link
          </label>
          <div class="capture">
            <input
              id="place-paste"
              class="capture__input"
              type="text"
              inputMode="text"
              autoComplete="off"
              value={pasted}
              placeholder="−12.3400, −56.0000"
              onInput={(event) => setPasted((event.currentTarget as HTMLInputElement).value)}
            />
            <button
              type="button"
              class="button button--outline"
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
        <button
          type="button"
          class="button button--quiet"
          disabled={busy}
          onClick={() => void locate()}
        >
          <span class="accent-icon">
            <Icon name="here" size={20} />
          </span>
          Here
        </button>
        {openHref === null ? (
          <button type="button" class="button" disabled>
            <Icon name="external" size={20} />
            Open in maps
          </button>
        ) : (
          <a class="button" href={openHref}>
            <Icon name="external" size={20} />
            Open in maps
          </a>
        )}
      </footer>
    </div>
  );
}
