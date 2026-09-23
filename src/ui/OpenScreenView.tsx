import type { Item, ItemOfType } from '../data/types.ts';
import type { AppContext } from '../services/database.ts';
import { PlaceScreen } from './PlaceScreen.tsx';
import { ReadingScreens } from './ReadingScreens.tsx';
import type { RecipeScreen } from './RecipeScreens.tsx';
import { RecipeScreens } from './RecipeScreens.tsx';
import type { WorkoutScreen } from './WorkoutScreens.tsx';
import { WorkoutScreens } from './WorkoutScreens.tsx';

/**
 * Whatever is open full-screen over the list. Each module's screens keep their own
 * navigation and back steps (SPECS §2.2, Back); the list only knows which module is open.
 */
export type OpenScreen =
  | { module: 'recipe'; initial: RecipeScreen }
  | { module: 'reading'; reading: ItemOfType<'reading'> }
  | { module: 'place'; place: ItemOfType<'place'> }
  | { module: 'workout'; initial: WorkoutScreen };

/** The screen a tapped row opens, or null for types that do not open (SPECS §2.2). */
export function screenFor(item: Item): OpenScreen | null {
  switch (item.type) {
    case 'recipe':
      return { module: 'recipe', initial: { mode: 'view', recipe: item } };
    case 'reading':
      return { module: 'reading', reading: item };
    case 'place':
      return { module: 'place', place: item };
    case 'routine':
      return { module: 'workout', initial: { kind: 'routine', routine: item } };
    case 'workout_log':
      return { module: 'workout', initial: { kind: 'log', log: item } };
    case 'exercise':
      return { module: 'workout', initial: { kind: 'exercise', exercise: item } };
    default:
      return null;
  }
}

/** Distinct per thing opened, so opening something else starts its screens afresh. */
function keyOf(screen: OpenScreen): string {
  switch (screen.module) {
    case 'recipe':
      return screen.initial.mode === 'new' ? 'recipe:new' : `recipe:${screen.initial.recipe.id}`;
    case 'reading':
      return `reading:${screen.reading.id}`;
    case 'place':
      return `place:${screen.place.id}`;
    case 'workout':
      return `workout:${workoutKey(screen.initial)}`;
  }
}

function workoutKey(initial: WorkoutScreen): string {
  switch (initial.kind) {
    case 'routine':
    case 'routine-edit':
      return initial.routine.id;
    case 'log':
      return initial.log.id;
    case 'exercise':
      return initial.exercise.id;
    case 'routine-new':
    case 'session':
      return initial.kind;
  }
}

interface OpenScreenViewProps {
  screen: OpenScreen;
  context: AppContext;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function OpenScreenView({ screen, context, onClose, onChanged }: OpenScreenViewProps) {
  const shared = { key: keyOf(screen), context, onClose, onChanged };
  switch (screen.module) {
    case 'recipe':
      return <RecipeScreens {...shared} initial={screen.initial} />;
    case 'reading':
      return <ReadingScreens {...shared} reading={screen.reading} />;
    case 'place':
      return <PlaceScreen {...shared} place={screen.place} />;
    case 'workout':
      return <WorkoutScreens {...shared} initial={screen.initial} />;
  }
}
