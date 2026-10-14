import type { ItemType } from '../data/types.ts';
import type { IconName } from './Icon.tsx';

/**
 * What the list can show, one category at a time (SPECS §2.2, The list).
 *
 * A category is a filter over `items`, not storage: adding one costs a row here. Workouts
 * spans three types because a routine, the sessions logged from it and the exercises they
 * use are one thing to the owner.
 */

export type CategoryId =
  'todo' | 'note' | 'grocery' | 'reading' | 'recipe' | 'place' | 'contact' | 'workouts' | 'habit';

export interface Category {
  id: CategoryId;
  label: string;
  icon: IconName;
  types: readonly ItemType[];
  /** What quick capture creates while this category is showing (SPECS §2.2). */
  captureType: ItemType;
  placeholder: string;
}

const CATEGORIES: Record<CategoryId, Category> = {
  todo: {
    id: 'todo',
    label: 'To-do',
    icon: 'todo',
    types: ['todo'],
    captureType: 'todo',
    placeholder: 'Add a to-do',
  },
  note: {
    id: 'note',
    label: 'Notes',
    icon: 'note',
    types: ['note'],
    captureType: 'note',
    placeholder: 'Capture a note',
  },
  grocery: {
    id: 'grocery',
    label: 'Running low',
    icon: 'grocery',
    types: ['grocery'],
    captureType: 'grocery',
    placeholder: 'Add to running low',
  },
  reading: {
    id: 'reading',
    label: 'Reading',
    icon: 'reading',
    types: ['reading'],
    captureType: 'reading',
    placeholder: 'Title to read',
  },
  recipe: {
    id: 'recipe',
    label: 'Recipes',
    icon: 'recipe',
    types: ['recipe'],
    captureType: 'recipe',
    placeholder: 'New recipe',
  },
  place: {
    id: 'place',
    label: 'Places',
    icon: 'place',
    types: ['place'],
    captureType: 'place',
    placeholder: 'Place to try',
  },
  contact: {
    id: 'contact',
    label: 'Contacts',
    icon: 'contact',
    types: ['contact'],
    captureType: 'contact',
    placeholder: 'Who you met',
  },
  workouts: {
    id: 'workouts',
    label: 'Workouts',
    icon: 'routine',
    types: ['routine', 'workout_log', 'exercise'],
    captureType: 'routine',
    placeholder: 'New routine',
  },
  habit: {
    id: 'habit',
    label: 'Habits',
    icon: 'habit',
    types: ['habit'],
    captureType: 'habit',
    placeholder: 'New habit',
  },
};

export const DEFAULT_CATEGORY: CategoryId = 'todo';

/** The row of icons below the habits. Habits are above it, not in it. */
export const LIST_CATEGORIES: readonly CategoryId[] = [
  'todo',
  'note',
  'grocery',
  'reading',
  'recipe',
  'place',
  'contact',
  'workouts',
];

/**
 * The capture type button's choices, in the order of the icon row. Exercises are created in
 * the routine picker and logs by finishing a workout, so neither is offered
 * (DECISIONS.md, 2026-09-23).
 */
export const CAPTURE_CATEGORIES: readonly CategoryId[] = [...LIST_CATEGORIES, 'habit'];

export function category(id: CategoryId): Category {
  return CATEGORIES[id];
}

const TYPE_ICON: Record<ItemType, IconName> = {
  note: 'note',
  todo: 'todo',
  contact: 'contact',
  grocery: 'grocery',
  habit: 'habit',
  recipe: 'recipe',
  reading: 'reading',
  place: 'place',
  routine: 'routine',
  workout_log: 'workout',
  exercise: 'exercise',
};

const TYPE_LABEL: Record<ItemType, string> = {
  note: 'Note',
  todo: 'To-do',
  contact: 'Contact',
  grocery: 'Running low',
  habit: 'Habit',
  recipe: 'Recipe',
  reading: 'Reading',
  place: 'Place',
  routine: 'Routine',
  workout_log: 'Workout',
  exercise: 'Exercise',
};

export function typeIcon(type: ItemType): IconName {
  return TYPE_ICON[type];
}

export function typeLabel(type: ItemType): string {
  return TYPE_LABEL[type];
}

/** Types whose `done` flag is meaningful, and so get a checkbox (SPECS §2.1). */
const CHECKABLE_TYPES: readonly ItemType[] = ['todo', 'grocery', 'reading'];

export function isCheckable(type: ItemType): boolean {
  return CHECKABLE_TYPES.includes(type);
}
