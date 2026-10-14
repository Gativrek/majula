import { MARK_END, MARK_START } from '../services/items.ts';

/**
 * Split a search hit's marked text into runs, each matched or not, so the matched words
 * can be drawn as marks (SPECS §2.2, Global search). Pure, so an unclosed or stray mark is
 * a test case rather than a broken row.
 */

export interface Run {
  text: string;
  marked: boolean;
}

export function splitMarks(text: string): Run[] {
  const runs: Run[] = [];
  let marked = false;
  let current = '';
  for (const char of text) {
    if (char === MARK_START || char === MARK_END) {
      if (current.length > 0) runs.push({ text: current, marked });
      current = '';
      marked = char === MARK_START;
      continue;
    }
    current += char;
  }
  if (current.length > 0) runs.push({ text: current, marked });
  return runs;
}
