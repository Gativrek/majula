import { useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import type { AppContext } from '../services/database.ts';
import { locateHere } from '../services/location.ts';
import {
  clearPlaceCoordinates,
  savePlaceDetails,
  setPlaceCoordinates,
} from '../services/places.ts';
import { PlaceDetail } from './PlaceDetail.tsx';
import { useBackStep } from './use-back-step.ts';

/** A place's screen (`docs/modules/places.md`). Back closes it (SPECS §2.2, Back). */

interface PlaceScreenProps {
  context: AppContext;
  place: ItemOfType<'place'>;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function PlaceScreen({ context, place: initial, onClose, onChanged }: PlaceScreenProps) {
  const [place, setPlace] = useState(initial);
  const placeId = place.id;

  useBackStep(true, onClose);

  /** Re-read the place after a change so the screen shows what was stored. */
  async function reload(): Promise<void> {
    const fresh = await context.items.get(placeId);
    if (fresh?.type === 'place') setPlace(fresh);
    await onChanged();
  }

  return (
    <PlaceDetail
      key={placeId}
      place={place}
      onSaveDetails={async (details) => {
        const result = await savePlaceDetails(context, placeId, details);
        if (result.ok) await reload();
        return result;
      }}
      onLocate={() => locateHere()}
      onSetCoordinates={async (coordinates) => {
        await setPlaceCoordinates(context, placeId, coordinates);
        await reload();
      }}
      onClearCoordinates={async () => {
        await clearPlaceCoordinates(context, placeId);
        await reload();
      }}
      onClose={onClose}
    />
  );
}
