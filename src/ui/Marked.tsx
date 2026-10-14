import { splitMarks } from './marks.ts';

/** Text from a search hit, with the words that matched drawn as marks. */
export function Marked({ text }: { text: string }) {
  return (
    <>
      {splitMarks(text).map((run, index) =>
        // Runs are recomputed from the same string every render, never reordered.
        run.marked ? <mark key={index}>{run.text}</mark> : run.text,
      )}
    </>
  );
}
