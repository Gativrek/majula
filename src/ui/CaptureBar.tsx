import { useState } from 'react';
import type { ItemType } from '../data/types.ts';
import type { Category, CategoryId } from './categories.ts';
import { Icon } from './Icon.tsx';
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

interface CaptureBarProps {
  category: Category;
  disabled: boolean;
  onCapture: (type: ItemType, title: string, tags: string[]) => Promise<void>;
  onPickCategory: (id: CategoryId) => void;
}

export function CaptureBar({ category, disabled, onCapture, onPickCategory }: CaptureBarProps) {
  const [title, setTitle] = useState('');
  const [tagText, setTagText] = useState('');
  const [tagsShown, setTagsShown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useBackStep(sheetOpen, function closeSheet() {
    setSheetOpen(false);
  });

  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && !saving && !disabled;

  async function save(): Promise<void> {
    if (!canSave) return;
    setSaving(true);
    try {
      await onCapture(category.captureType, trimmed, parseTags(tagText));
      setTitle('');
      setTagText('');
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
          <input
            class="field capture-bar__tags"
            type="text"
            value={tagText}
            placeholder="Tags, separated by spaces"
            aria-label="Tags, separated by spaces"
            autoComplete="off"
            disabled={disabled}
            onInput={(event) => setTagText((event.currentTarget as HTMLInputElement).value)}
          />
        ) : null}
        <div class="capture-bar__row">
          <button
            type="button"
            class="capture-bar__type"
            aria-label={`Capture as ${category.label}. Change type`}
            onClick={() => setSheetOpen(true)}
          >
            <Icon name={category.icon} />
          </button>
          <label class="capture-bar__field">
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
