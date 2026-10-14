import type { IconName } from './Icon.tsx';
import { Icon } from './Icon.tsx';

/**
 * The header of an opened entry: back, what kind of entry it is, and, where the entry can
 * be edited in place, the pencil that turns its title into fields. Back here is the same
 * step as the system back button.
 */

interface EditToggle {
  editing: boolean;
  label: string;
  onToggle: () => void;
}

interface ModuleHeaderProps {
  icon: IconName;
  label: string;
  onBack: () => void;
  /** What back does, said to assistive technology: Back, Cancel, Discard workout. */
  backLabel?: string;
  backIcon?: IconName;
  edit?: EditToggle;
}

export function ModuleHeader({
  icon,
  label,
  onBack,
  backLabel,
  backIcon,
  edit,
}: ModuleHeaderProps) {
  return (
    <header class="top-bar top-bar--module">
      <button type="button" class="icon-button" aria-label={backLabel ?? 'Back'} onClick={onBack}>
        <Icon name={backIcon ?? 'back'} />
      </button>
      <span class="top-bar__kicker">
        <Icon name={icon} size={18} />
        {label}
      </span>
      {edit === undefined ? null : (
        <button
          type="button"
          class="icon-button"
          aria-pressed={edit.editing}
          aria-label={edit.editing ? 'Cancel editing' : edit.label}
          onClick={edit.onToggle}
        >
          <Icon name={edit.editing ? 'close' : 'edit'} />
        </button>
      )}
    </header>
  );
}
