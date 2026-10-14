import type { IconName } from './Icon.tsx';
import { Icon } from './Icon.tsx';

/**
 * The header of an opened entry: back, what kind of entry it is, and the pencil that turns
 * its title into fields. Back here is the same step as the system back button.
 */

interface ModuleHeaderProps {
  icon: IconName;
  label: string;
  editing: boolean;
  editLabel: string;
  onBack: () => void;
  onToggleEdit: () => void;
}

export function ModuleHeader(props: ModuleHeaderProps) {
  return (
    <header class="top-bar top-bar--module">
      <button type="button" class="icon-button" aria-label="Back" onClick={props.onBack}>
        <Icon name="back" />
      </button>
      <span class="top-bar__kicker">
        <Icon name={props.icon} size={18} />
        {props.label}
      </span>
      <button
        type="button"
        class="icon-button"
        aria-pressed={props.editing}
        aria-label={props.editing ? 'Cancel editing' : props.editLabel}
        onClick={props.onToggleEdit}
      >
        <Icon name={props.editing ? 'close' : 'edit'} />
      </button>
    </header>
  );
}
