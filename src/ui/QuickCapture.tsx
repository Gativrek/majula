import { useState } from 'react';
import type { ItemType } from '../data/types.ts';

/**
 * Quick capture (SPECS §2.2). Defaults to `note`. The type comes from the chips and
 * nothing else: GATE P1 closed on no prefix syntax, because a note that legitimately
 * opens with a prefix-shaped string would be filed as the wrong type with no signal.
 *
 * It sits in the footer so the input and the save control are in the lower half of the
 * screen, reachable one-handed (SPECS §6).
 *
 * The tag field is hidden until asked for. Tags are optional on every type that has them
 * (§2.1), and the default path — open, type, save — must not grow a field to skip past.
 */

/** The types Phase 4 can capture. The rest arrive with the phases that build them. */
const CAPTURABLE_TYPES: readonly { type: ItemType; label: string }[] = [
  { type: 'note', label: 'Note' },
  { type: 'todo', label: 'To-do' },
  { type: 'contact', label: 'Contact' },
  { type: 'grocery', label: 'Running low' },
  { type: 'habit', label: 'Habit' },
  { type: 'recipe', label: 'Recipe' },
];

/** Tags are separated by whitespace or commas, and stored exactly as typed. */
export function parseTags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#/, ''))
    .filter((tag) => tag.length > 0);
}

interface QuickCaptureProps {
  onCapture: (type: ItemType, title: string, tags: string[]) => Promise<void>;
  disabled: boolean;
}

export function QuickCapture({ onCapture, disabled }: QuickCaptureProps) {
  const [type, setType] = useState<ItemType>('note');
  const [title, setTitle] = useState('');
  const [tagText, setTagText] = useState('');
  const [tagsShown, setTagsShown] = useState(false);
  const [saving, setSaving] = useState(false);

  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && !saving && !disabled;

  async function save(): Promise<void> {
    if (!canSave) return;
    setSaving(true);
    try {
      await onCapture(type, trimmed, parseTags(tagText));
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

  return (
    <form class="capture-form" onSubmit={onSubmit}>
      <div class="chips" role="group" aria-label="Capture type">
        {CAPTURABLE_TYPES.map((chip) => (
          <button
            key={chip.type}
            type="button"
            class="chip"
            aria-pressed={type === chip.type}
            onClick={() => setType(chip.type)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {tagsShown ? (
        <input
          class="capture__input capture__input--tags"
          type="text"
          value={tagText}
          placeholder="Tags"
          aria-label="Tags, separated by spaces"
          autoComplete="off"
          disabled={disabled}
          onInput={(event) => setTagText((event.currentTarget as HTMLInputElement).value)}
        />
      ) : null}

      <div class="capture">
        <input
          class="capture__input"
          type="text"
          value={title}
          placeholder="Capture"
          aria-label="What to capture"
          autoComplete="off"
          enterKeyHint="done"
          disabled={disabled}
          onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)}
        />
        <button
          type="button"
          class="icon-button"
          aria-pressed={tagsShown}
          aria-label={tagsShown ? 'Hide tags' : 'Add tags'}
          onClick={() => setTagsShown(!tagsShown)}
        >
          #
        </button>
        <button class="button" type="submit" disabled={!canSave}>
          Save
        </button>
      </div>
    </form>
  );
}
