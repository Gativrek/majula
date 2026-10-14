import { useState } from 'react';
import type { ItemOfType } from '../data/types.ts';
import type { AppContext } from '../services/database.ts';
import { joinNote, saveNoteText } from '../services/notes.ts';
import { Icon } from './Icon.tsx';
import { ModuleHeader } from './ModuleHeader.tsx';
import { useBackStep } from './use-back-step.ts';

/**
 * A note opened from the list (`docs/modules/notes.md` criteria 10–11): its title and its
 * whole body, line breaks kept. The pencil makes the whole text one field, the first line
 * the title as at capture; back or the × cancels and writes nothing (SPECS §2.2, Back).
 */

interface NoteScreenProps {
  context: AppContext;
  note: ItemOfType<'note'>;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function NoteScreen({ context, note: initial, onClose, onChanged }: NoteScreenProps) {
  const [note, setNote] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(joinNote(initial.title, initial.body));
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useBackStep(true, onClose);
  useBackStep(editing, cancelEdit);

  function cancelEdit(): void {
    setText(joinNote(note.title, note.body));
    setProblem(null);
    setEditing(false);
  }

  async function save(): Promise<void> {
    setSaving(true);
    try {
      const result = await saveNoteText(context, note.id, text);
      if (!result.ok) {
        setProblem(result.message);
        return;
      }
      const fresh = await context.items.get(note.id);
      if (fresh?.type === 'note') setNote(fresh);
      setProblem(null);
      setEditing(false);
      await onChanged();
    } catch (error) {
      setProblem(
        `That did not save: ${error instanceof Error ? error.message : 'unknown failure'}.`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="kitchen kitchen--editing">
      <ModuleHeader
        icon="note"
        label="Note"
        onBack={onClose}
        edit={{
          editing,
          label: 'Edit note',
          onToggle: () => (editing ? cancelEdit() : setEditing(true)),
        }}
      />

      <main class="kitchen__body">
        {editing ? (
          <textarea
            class="capture__input note__text"
            value={text}
            aria-label="Note, first line the title"
            onInput={(event) => setText((event.currentTarget as HTMLTextAreaElement).value)}
          />
        ) : (
          <div class="kitchen__heading-block">
            <h2 class="module-title">{note.title}</h2>
            {note.body === null ? null : <p class="module-body note__body">{note.body}</p>}
          </div>
        )}
        {problem === null ? null : <p class="banner banner--error">{problem}</p>}
      </main>

      {editing ? (
        <footer class="kitchen__actions">
          <button type="button" class="button" disabled={saving} onClick={() => void save()}>
            <Icon name="check" size={20} />
            Save note
          </button>
        </footer>
      ) : null}
    </div>
  );
}
