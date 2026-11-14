import type { CategoryId } from './categories.ts';
import type { OpenScreen } from './OpenScreenView.tsx';

/**
 * The category an open screen belongs to, for its colour (SPECS §2.2, Look and motion: a
 * screen opened from a category carries that category's colour). Routines, logs and
 * exercises are all Workouts, as on the list.
 */
export function categoryOfScreen(screen: OpenScreen): CategoryId {
  switch (screen.module) {
    case 'note':
      return 'note';
    case 'recipe':
      return 'recipe';
    case 'reading':
      return 'reading';
    case 'place':
      return 'place';
    case 'workout':
      return 'workouts';
  }
}
