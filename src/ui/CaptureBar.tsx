import { useState } from 'react';
import type { ItemType } from '../data/types.ts';
import type { Category, CategoryId } from './categories.ts';
import { Icon } from './Icon.tsx';
import { finalTags } from './tag-entry.ts';
import { TagField } from './TagField.tsx';
import { TypeSheet } from './TypeSheet.tsx';
import { useBackStep } from './use-back-step.ts';

/**
 * Quick capture (SPECS §2.2), one row at the foot of the home screen so the input and the
 * save control sit under the thumb (§6).
 *
 * What it captures is the category the list shows. The button at its left shows that
 * type and opens every capturable type; picking one there switches the list too, so what
 * was just captured is always in view. The type is never parsed from the text: GATE P1
 * closed on no prefix syntax.
 *
 * The tag field is hidden until asked for, so the default path — type, save — has no field
 * to skip past.
 */

/** Tags are separated by whitespace or commas, and stored exactly as typed. */
export function parseTags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#/, ''))
    .filter((tag) => tag.length > 0);
}

/** A note's field grows with its text up to this many lines, then scrolls. */
const MAX_LINES = 6;

interface CaptureBarProps {
  category: Category;
  disabled: boolean;
  /** The owner's tags with how often each is used, to offer while tagging. */
  knownTags: readonly { tag: string; count: number }[];
  /** Resolves false when the capture failed: the typed text then stays to try again. */
  onCapture: (type: ItemType, text: string, tags: string[]) => Promise<boolean>;
  onPickCategory: (id: CategoryId) => void;
}

export function CaptureBar(props: CaptureBarProps) {
  const { category, disabled, onCapture, onPickCategory } = props;
  const [title, setTitle] = useState('');
  const [tagEntry, setTagEntry] = useState<{ tags: string[]; draft: string }>({
    tags: [],
    draft: '',
  });
  const [tagsShown, setTagsShown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useBackStep(sheetOpen, function closeSheet() {
    setSheetOpen(false);
  });

  // notes.md criterion 1: a note may run to several lines, so Enter starts a new one and
  // only the save button saves. Every other type is one line, where Enter saves.
  const multiline = category.captureType === 'note';
  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && !saving && !disabled;
  const lines = Math.min(Math.max(title.split('\n').length, 1), MAX_LINES);

  async function save(): Promise<void> {
    if (!canSave) return;
    setSaving(true);
    try {
      const tags = finalTags(tagEntry.tags, tagEntry.draft);
      // Lines typed as a note and then switched to a one-line type become one line.
      const text = multiline ? trimmed : trimmed.replace(/\s*\n\s*/g, ' ');
      if (!(await onCapture(category.captureType, text, tags))) return;
      setTitle('');
      setTagEntry({ tags: [], draft: '' });
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(event: Event): void {
    event.preventDefault();
    void save();
  }

  function pick(id: CategoryId): void {
    setSheetOpen(false);
    onPickCategory(id);
  }

  return (
    <>
      {sheetOpen ? (
        <TypeSheet selected={category.id} onPick={pick} onDismiss={() => setSheetOpen(false)} />
      ) : null}
      <form class="capture-bar" onSubmit={onSubmit}>
        {tagsShown ? (
          <TagField
            tags={tagEntry.tags}
            draft={tagEntry.draft}
            known={props.knownTags}
            disabled={disabled}
            onChange={setTagEntry}
          />
        ) : null}
        <div class="capture-bar__row">
          <button
            type="button"
            class="capture-bar__type"
            aria-label={`Capture as ${category.captureLabel}. Change type`}
            onClick={() => setSheetOpen(true)}
          >
            <Icon name={category.icon} />
          </button>
          <label class="capture-bar__field">
            {multiline ? (
              <textarea
                value={title}
                rows={lines}
                placeholder={category.placeholder}
                aria-label="What to capture"
                autoComplete="off"
                disabled={disabled}
                onInput={(event) => setTitle((event.currentTarget as HTMLTextAreaElement).value)}
              />
            ) : (
              <input
                type="text"
                value={title}
                placeholder={category.placeholder}
                aria-label="What to capture"
                autoComplete="off"
                enterKeyHint="done"
                disabled={disabled}
                onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)}
              />
            )}
            <button
              type="button"
              class="capture-bar__tag-toggle"
              aria-pressed={tagsShown}
              aria-label={tagsShown ? 'Hide tags' : 'Add tags'}
              onClick={() => setTagsShown(!tagsShown)}
            >
              <Icon name="tag" size={20} />
            </button>
          </label>
          <button type="submit" class="capture-bar__save" aria-label="Save" disabled={!canSave}>
            <Icon name="send" />
          </button>
        </div>
      </form>
    </>
  );
}
