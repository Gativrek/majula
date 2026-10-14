import { Icon } from './Icon.tsx';

/** A dismissable notice above the list, such as a refused share. It never blocks. */

interface NoticeBannerProps {
  notice: string | null;
  onDismiss: () => void;
}

export function NoticeBanner({ notice, onDismiss }: NoticeBannerProps) {
  if (notice === null) return null;
  return (
    <div class="banner banner--info notice">
      <span>{notice}</span>
      <button type="button" class="icon-button" aria-label="Dismiss" onClick={onDismiss}>
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
