import { Icon } from './Icon.tsx';
import { commitDraft, suggestTags } from './tag-entry.ts';

/**
 * Tags for quick capture: each finished tag a pill that can be removed, the one being
 * typed, and the owner's most-used tags to tap instead of typing.
 */

interface TagFieldProps {
  tags: readonly string[];
  draft: string;
  known: readonly { tag: string; count: number }[];
  disabled: boolean;
  onChange: (next: { tags: string[]; draft: string }) => void;
}

export function TagField({ tags, draft, known, disabled, onChange }: TagFieldProps) {
  const suggestions = suggestTags(known, tags);
  return (
    <div class="tag-field">
      <div class="tag-field__row">
        {tags.map((tag) => (
          <span key={tag} class="tag-pill">
            {`#${tag}`}
            <button
              type="button"
              class="tag-pill__remove"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange({ tags: tags.filter((t) => t !== tag), draft })}
            >
              <Icon name="close" size={14} />
            </button>
          </span>
        ))}
        <input
          class="tag-field__input"
          type="text"
          value={draft}
          placeholder={tags.length === 0 ? 'Tags, separated by spaces' : 'Another tag'}
          aria-label="Tags, separated by spaces"
          autoComplete="off"
          autoCapitalize="off"
          disabled={disabled}
          onInput={(event) =>
            onChange(commitDraft(tags, (event.currentTarget as HTMLInputElement).value))
          }
        />
      </div>
      {suggestions.length === 0 ? null : (
        <div class="tag-field__row">
          <span class="tag-field__hint">Yours:</span>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              class="tag-chip tag-chip--small"
              onClick={() => onChange({ tags: [...tags, tag], draft })}
            >
              {`#${tag}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
