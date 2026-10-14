/**
 * Typing tags in quick capture (SPECS §2.2): each finished tag becomes a pill, and the
 * owner's own tags are offered to tap. Pure, so what counts as a finished tag is a test.
 *
 * Tags are stored exactly as typed (`docs/modules/notes.md` criterion 6), so nothing here
 * folds case; `GNSS` and `gnss` stay two tags.
 */

/** Tags are separated by whitespace or commas, and a leading `#` is not part of one. */
export function parseTags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#/, ''))
    .filter((tag) => tag.length > 0);
}

function unique(tags: readonly string[]): string[] {
  return [...new Set(tags)];
}

/**
 * Move every finished tag out of the draft. A tag is finished once a space or comma follows
 * it; what comes after the last separator is still being typed and stays.
 */
export function commitDraft(
  tags: readonly string[],
  draft: string,
): { tags: string[]; draft: string } {
  const lastSeparator = Math.max(draft.lastIndexOf(' '), draft.lastIndexOf(','));
  if (lastSeparator < 0) return { tags: [...tags], draft };
  return {
    tags: unique([...tags, ...parseTags(draft.slice(0, lastSeparator))]),
    draft: draft.slice(lastSeparator + 1),
  };
}

/** Everything to store on save: the pills, and whatever is still in the draft. */
export function finalTags(tags: readonly string[], draft: string): string[] {
  return unique([...tags, ...parseTags(draft)]);
}

/** The owner's most-used tags not already chosen, to tap instead of type. */
export function suggestTags(
  known: readonly { tag: string; count: number }[],
  chosen: readonly string[],
  limit = 4,
): string[] {
  return [...known]
    .filter((entry) => !chosen.includes(entry.tag))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit)
    .map((entry) => entry.tag);
}
