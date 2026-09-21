import type { Item } from '../data/types.ts';
import { ItemRow } from './ItemRow.tsx';

/**
 * The single list view of Phase 1 (ROADMAP Phase 1). Tag views and per-type views in
 * Phase 2 are filters over this same list, not new screens.
 */

interface ItemListProps {
  items: readonly Item[];
  emptyMessage: string;
  onToggleDone: (item: Item) => void;
  onDelete: (item: Item) => void;
  onRestore?: (item: Item) => void;
}

export function ItemList({
  items,
  emptyMessage,
  onToggleDone,
  onDelete,
  onRestore,
}: ItemListProps) {
  if (items.length === 0) {
    return <p class="empty">{emptyMessage}</p>;
  }

  return (
    <ul class="item-list">
      {items.map((item) => (
        // Keyed by entity id, never by index: rows get soft-deleted and reordered
        // (CODESTYLE §12).
        <ItemRow
          key={item.id}
          item={item}
          onToggleDone={onToggleDone}
          onDelete={onDelete}
          {...(onRestore === undefined ? {} : { onRestore })}
        />
      ))}
    </ul>
  );
}
