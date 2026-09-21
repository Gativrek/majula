import { useState } from 'react';
import type { ItemType } from '../data/types.ts';

/**
 * Quick capture (SPECS §2.2). Defaults to `note`. The type comes from the chips and
 * nothing else: GATE P1 closed on no prefix syntax, because a note that legitimately
 * opens with a prefix-shaped string would be filed as the wrong type with no signal.
 *
 * It sits in the footer so the input and the save button are in the lower half of the
 * screen, reachable one-handed (SPECS §6).
 */

/** The types Phase 1 can capture. The rest arrive with the phases that build them. */
const CAPTURABLE_TYPES: readonly { type: ItemType; label: string }[] = [
  { type: 'note', label: 'Note' },
  { type: 'todo', label: 'To-do' },
  { type: 'contact', label: 'Contact' },
  { type: 'grocery', label: 'Running low' },
];

interface QuickCaptureProps {
  onCapture: (type: ItemType, title: string) => Promise<void>;
  disabled: boolean;
}

export function QuickCapture({ onCapture, disabled }: QuickCaptureProps) {
  const [type, setType] = useState<ItemType>('note');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && !saving && !disabled;

  async function save(): Promise<void> {
    if (!canSave) return;
    setSaving(true);
    try {
      await onCapture(type, trimmed);
      setTitle('');
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
        <button class="button" type="submit" disabled={!canSave}>
          Save
        </button>
      </div>
    </form>
  );
}
