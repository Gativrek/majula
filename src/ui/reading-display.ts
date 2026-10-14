/**
 * How a reading entry's link and position read on its screen (`docs/modules/reading-queue.md`
 * criteria 2–3). Pure, so which addresses become links is a test, not a hope.
 */

/** Only an http(s) address is offered as a link; anything else is shown as typed. */
export function openableUrl(url: string | null): string | null {
  if (url === null) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/** The address without its scheme or a trailing slash, which are noise on a phone. */
export function shownUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** The main button's words: open from the start, or carry on where reading stopped. */
export function continueLabel(lastPage: number | undefined): string {
  return lastPage === undefined || lastPage <= 1 ? 'Open PDF' : `Continue on page ${lastPage}`;
}
