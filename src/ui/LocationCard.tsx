import { formatCoordinates } from '../services/coordinates.ts';
import { Icon } from './Icon.tsx';

/**
 * Where a place is (`docs/modules/places.md`), led by what that means rather than by the
 * numbers: saved or not, and where it came from. The coordinates are a small line with a
 * copy button, for the rare time they are pasted somewhere else.
 */

interface LocationCardProps {
  lat: number | undefined;
  lon: number | undefined;
  hasListing: boolean;
  busy: boolean;
  onClear: () => void;
  onCopy: (text: string) => void;
}

function sourceLine(hasCoordinates: boolean, hasListing: boolean): string {
  if (hasListing && hasCoordinates) return 'From a Google Maps listing, with coordinates';
  if (hasListing) return 'Google Maps listing kept · no coordinates in it';
  if (hasCoordinates) return 'From here, or pasted coordinates';
  return 'Tap Here, or paste coordinates or a Maps link';
}

export function LocationCard({ lat, lon, hasListing, busy, onClear, onCopy }: LocationCardProps) {
  const hasCoordinates = lat !== undefined && lon !== undefined;
  const saved = hasCoordinates || hasListing;
  const coordinates = hasCoordinates ? formatCoordinates(lat, lon) : null;

  return (
    <section class="card">
      <div class="card__row">
        <span class={saved ? 'tile tile--accent' : 'tile'}>
          <Icon name={saved ? 'pinCheck' : 'place'} />
        </span>
        <span class="row__text">
          <span class="row__title">{saved ? 'Location saved' : 'No location yet'}</span>
          <span class="row__meta row__meta--wrap">{sourceLine(hasCoordinates, hasListing)}</span>
        </span>
        {saved ? (
          <button type="button" class="text-button" disabled={busy} onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>
      {coordinates === null ? null : (
        <div class="card__foot">
          <span class="card__coordinates">{coordinates}</span>
          <button
            type="button"
            class="icon-button icon-button--small"
            aria-label="Copy coordinates"
            onClick={() => onCopy(coordinates)}
          >
            <Icon name="copy" size={16} />
          </button>
        </div>
      )}
      <p class="card__note">
        <Icon name="shield" size={16} />
        Stays on this phone. Here works without signal.
      </p>
    </section>
  );
}
