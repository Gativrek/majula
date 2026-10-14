/**
 * A note as one piece of text (`docs/modules/notes.md` criteria 1, 10–11): its first line
 * is the title and the lines after it the body. Typed and edited whole; stored in the
 * generic `title` and `body` columns, which global search already covers.
 */

import type { AppContext } from './database.ts';

export interface NoteParts {
  title: string;
  body: string | null;
}

/**
 * Split typed text into title and body. Only the ends are trimmed — of the whole text, and
 * of the title line — so blank lines and indentation inside the body stay as typed.
 */
export function splitNote(text: string): NoteParts {
  const whole = text.replace(/^\s+|\s+$/g, '');
  const lineEnd = whole.indexOf('\n');
  if (lineEnd === -1) return { title: whole, body: null };
  const title = whole.slice(0, lineEnd).trim();
  const body = whole.slice(lineEnd + 1).replace(/^\s*\n/, '');
  return { title, body: body.length === 0 ? null : body };
}

/** The text a note is edited as: the title, then the body on the lines below. */
export function joinNote(title: string, body: string | null): string {
  return body === null || body.length === 0 ? title : `${title}\n${body}`;
}

export type NoteResult = { ok: true } | { ok: false; message: string };

/** Store an edited note, refusing one left with no text at all (criterion 11). */
export async function saveNoteText(
  context: AppContext,
  noteId: string,
  text: string,
): Promise<NoteResult> {
  const { title, body } = splitNote(text);
  if (title.length === 0) return { ok: false, message: 'A note needs some text.' };
  await context.items.update<'note'>(noteId, { title, body });
  return { ok: true };
}
