import { BonfireMark } from './BonfireMark.tsx';
import { Icon } from './Icon.tsx';

/** The home screen's header: the name, search, and the way to Deleted and Backup. */

interface HomeHeaderProps {
  onSearch: () => void;
  onLibrary: () => void;
}

export function HomeHeader({ onSearch, onLibrary }: HomeHeaderProps) {
  return (
    <header class="top-bar">
      <span class="top-bar__brand">
        <BonfireMark size={34} />
      </span>
      <h1 class="top-bar__title">Majula</h1>
      <button type="button" class="icon-button" aria-label="Search" onClick={onSearch}>
        <Icon name="search" />
      </button>
      <button type="button" class="icon-button" aria-label="Deleted and backup" onClick={onLibrary}>
        <Icon name="more" />
      </button>
    </header>
  );
}
