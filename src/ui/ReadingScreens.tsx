import { useCallback, useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import type { AppContext } from '../services/database.ts';
import {
  attachPdf,
  openReadingPdf,
  saveLastPage,
  saveReadingDetails,
  saveReadingView,
  viewOf,
} from '../services/reading.ts';
import { toggleDone } from '../services/items.ts';
import { PdfViewer } from './PdfViewer.tsx';
import { ReadingDetail } from './ReadingDetail.tsx';
import { useBackStep } from './use-back-step.ts';
import { log } from '../lib/logger.ts';

/**
 * The reading queue's screens (`docs/modules/reading-queue.md`): an entry's detail, and
 * its PDF in the viewer.
 */

/**
 * Page turns and view changes are saved without waiting, so this owns their failure: a
 * save that fails is logged, never an unhandled rejection (CODESTYLE §8). The reading
 * carries on either way; the worst case is reopening on an earlier page.
 */
async function remember(saving: Promise<void>): Promise<void> {
  try {
    await saving;
  } catch (cause) {
    log.error('reading.save_failed', {
      reason: cause instanceof Error ? cause.message : 'unknown',
    });
  }
}

interface ReadingScreensProps {
  context: AppContext;
  reading: ItemOfType<'reading'>;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function ReadingScreens({
  context,
  reading: initial,
  onClose,
  onChanged,
}: ReadingScreensProps) {
  const [reading, setReading] = useState(initial);
  const [viewing, setViewing] = useState(false);

  // SPECS §2.2, Back: back closes the viewer, then the entry (criterion 13).
  useBackStep(true, onClose);
  useBackStep(viewing, function closeViewer() {
    setViewing(false);
  });

  // The viewer opens its document in an effect keyed on this function, so it changes only
  // when a different entry is opened — not when a page turn re-reads the same one.
  const readingId = reading.id;
  const openPdf = useCallback(() => openReadingPdf(context, readingId), [context, readingId]);

  /** Re-read the entry after a change so the screen shows what was stored. */
  async function reload(): Promise<void> {
    const fresh = await context.items.get(readingId);
    if (fresh?.type === 'reading') setReading(fresh);
    await onChanged();
  }

  if (viewing) {
    return (
      <PdfViewer
        title={reading.title}
        open={openPdf}
        initialView={viewOf(reading)}
        onPageChange={(page) => void remember(saveLastPage(context, readingId, page))}
        onViewChange={(view) => void remember(saveReadingView(context, readingId, view))}
        onClose={() => {
          setViewing(false);
          void remember(reload());
        }}
      />
    );
  }

  return (
    <ReadingDetail
      key={reading.id}
      reading={reading}
      onSaveDetails={async (details) => {
        const result = await saveReadingDetails(context, readingId, details);
        if (result.ok) await reload();
        return result;
      }}
      onAttach={async (file) => {
        const result = await attachPdf(context, readingId, file);
        if (result.ok) await reload();
        return result;
      }}
      onToggleRead={async () => {
        await toggleDone(context, reading);
        await reload();
      }}
      onOpenPdf={() => setViewing(true)}
      onClose={onClose}
    />
  );
}
