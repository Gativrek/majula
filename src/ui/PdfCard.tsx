import type { ItemOfType } from '../data/types.ts';
import { Icon } from './Icon.tsx';

/**
 * A reading entry's PDF: its page count and where reading stopped, plus the trim and zoom
 * the viewer will reopen with (`docs/modules/reading-queue.md` criteria 8, 10).
 */
export function PdfCard({ reading }: { reading: ItemOfType<'reading'> }) {
  const { page_count: pages, last_page: lastPage, zoom, trim_margins: trimmed } = reading.payload;
  const page = lastPage ?? 1;
  return (
    <section class="card">
      <div class="card__row">
        <span class="tile">
          <Icon name="file" />
        </span>
        <span class="row__text">
          <span class="row__title">PDF</span>
          <span class="row__meta">
            {pages === undefined ? 'Copy kept in Majula' : `${pages} pages · copy kept in Majula`}
          </span>
        </span>
      </div>
      {pages === undefined ? null : (
        <div class="progress">
          <span class="progress__figure">
            {`p. ${page}`}
            <span class="progress__of">{` of ${pages}`}</span>
          </span>
          <span
            class="progress__track"
            role="progressbar"
            aria-label="Reading position"
            aria-valuemin={1}
            aria-valuemax={pages}
            aria-valuenow={page}
          >
            <span class="progress__fill" style={{ width: `${(page / pages) * 100}%` }} />
          </span>
        </div>
      )}
      {trimmed === true || (zoom !== undefined && zoom !== 1) ? (
        <div class="tag-row">
          {trimmed === true ? <span class="chip-static">Margins trimmed</span> : null}
          {zoom !== undefined && zoom !== 1 ? (
            <span class="chip-static">{`${Math.round(zoom * 100)}%`}</span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
