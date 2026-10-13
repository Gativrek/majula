import { useEffect, useRef } from 'react';
import type { ItemOfType } from '../data/types.ts';
import type { AppContext } from '../services/database.ts';
import { parseMapsShare } from '../services/maps-link.ts';
import { addPlaceFromShare } from '../services/places.ts';
import type { SharedText } from '../services/share-inbox.ts';
import { listenForShares } from '../services/share-inbox.ts';

/**
 * Shares from other apps (`docs/modules/places.md` 15–17). A Google Maps listing becomes
 * a place, or opens the one already kept; anything else is refused and writes nothing.
 */

interface ShareOutcomes {
  /** The place to open: new, or the one this listing was already kept as. */
  onPlace: (place: ItemOfType<'place'>) => void;
  /** What to tell the owner when a share was refused or could not be saved. */
  onProblem: (message: string) => void;
}

async function receive(
  context: AppContext,
  share: SharedText,
  outcomes: ShareOutcomes,
): Promise<void> {
  const parsed = parseMapsShare(share.text, share.subject);
  if (parsed === null) {
    outcomes.onProblem('That share had no Google Maps link in it, so nothing was saved.');
    return;
  }
  try {
    const { place } = await addPlaceFromShare(context, parsed);
    outcomes.onPlace(place);
  } catch (error) {
    outcomes.onProblem(
      `The shared place could not be saved: ${error instanceof Error ? error.message : 'unknown failure'}.`,
    );
  }
}

/**
 * Listen for shares while the database is open. The outcomes are read through a ref so
 * the listener attaches once per open database, not once per render; the plugin holds a
 * share that cold-started the app until it does.
 */
export function useShareReceiver(context: AppContext | null, outcomes: ShareOutcomes): void {
  const latest = useRef(outcomes);
  latest.current = outcomes;

  useEffect(
    function receiveShares() {
      if (context === null) return undefined;
      return listenForShares(function handleShare(share) {
        void receive(context, share, latest.current);
      });
    },
    [context],
  );
}
