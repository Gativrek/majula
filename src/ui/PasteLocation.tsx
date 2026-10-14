import { useState } from 'react';
import { parseCoordinates } from '../services/coordinates.ts';
import type { Coordinates } from '../services/maps-link.ts';
import { coordinatesFromMapsLink, findMapsLink } from '../services/maps-link.ts';

/**
 * Setting a place from something pasted (`docs/modules/places.md`): a Google Maps link,
 * kept so **Open in maps** opens that listing, or plain coordinates. Whatever was pasted is
 * cleared once it is set, and kept when it is refused so it can be corrected.
 */

export type Message = { kind: 'info' | 'error'; text: string } | null;

interface PasteLocationProps {
  busy: boolean;
  /** The place screen's runner: it marks the screen busy and shows the message returned. */
  run: (work: () => Promise<Message>) => Promise<void>;
  onSetCoordinates: (coordinates: { lat: number; lon: number }) => Promise<void>;
  onSetLink: (link: { url: string; coordinates: Coordinates | null }) => Promise<void>;
}

export function PasteLocation({ busy, run, onSetCoordinates, onSetLink }: PasteLocationProps) {
  const [pasted, setPasted] = useState('');

  function setFromPaste(): Promise<void> {
    return run(async function usePasted(): Promise<Message> {
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

  return (
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
  );
}
