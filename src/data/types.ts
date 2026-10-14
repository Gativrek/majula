/**
 * The shape of everything in the `items` table (SPECS §4.2, §4.3).
 *
 * Types are declared here once and imported from here. A component that redeclares
 * the shape of a recipe is a second source of truth (CODESTYLE §9).
 */

import type { Timestamp } from '../lib/time.ts';

export const ITEM_TYPES = [
  'note',
  'todo',
  'reading',
  'contact',
  'habit',
  'grocery',
  'recipe',
  'routine',
  'workout_log',
  'exercise',
  'place',
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

export function isItemType(value: unknown): value is ItemType {
  return typeof value === 'string' && (ITEM_TYPES as readonly string[]).includes(value);
}

/** Types whose type-specific fields fit the generic columns (SPECS §4.3). */
export type EmptyPayload = Record<string, never>;

export interface ReadingPayload {
  /** Path inside the app's private storage, relative to the data root (ADR-004). */
  pdf_path?: string;
  page_count?: number;
  last_page?: number;
  /** How the viewer draws this document, remembered with the page (reading-queue.md 15c). */
  zoom?: number;
  trim_margins?: boolean;
}

/**
 * SPECS §4.3, amended 2026-09-23: `qty` and `unit` are each optional so that "sal a
 * gosto" is an ingredient rather than a step. Absent means absent — never `0` or `''`.
 */
export interface RecipeIngredient {
  qty?: number;
  unit?: string;
  name: string;
}

export interface RecipePayload {
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export interface RoutineExercise {
  exercise_id: string;
  sets: number;
  reps: number;
  load_kg: number;
}

export interface RoutinePayload {
  exercises: RoutineExercise[];
}

export interface PerformedSet {
  reps: number;
  load_kg: number;
}

export interface PerformedExercise {
  exercise_id: string;
  sets: PerformedSet[];
}

export interface WorkoutLogPayload {
  routine_id: string;
  performed: PerformedExercise[];
}

export interface PlacePayload {
  lat?: number;
  lon?: number;
}

/** One payload shape per variant, keyed by `items.type` (CODESTYLE §9). */
export interface PayloadByType {
  note: EmptyPayload;
  todo: EmptyPayload;
  reading: ReadingPayload;
  contact: EmptyPayload;
  habit: EmptyPayload;
  grocery: EmptyPayload;
  recipe: RecipePayload;
  routine: RoutinePayload;
  workout_log: WorkoutLogPayload;
  exercise: EmptyPayload;
  place: PlacePayload;
}

interface ItemBase<T extends ItemType> {
  id: string;
  type: T;
  title: string;
  body: string | null;
  url: string | null;
  done: boolean;
  payload: PayloadByType[T];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

/**
 * A row of `items`, narrowed by `type`. The compiler, not a comment, is what stops a
 * `recipe` payload reaching `routine` code (CODESTYLE §9).
 */
export type Item = { [T in ItemType]: ItemBase<T> }[ItemType];

export type ItemOfType<T extends ItemType> = ItemBase<T>;

/** The fields a caller supplies when creating an item; the rest are generated. */
export interface NewItem<T extends ItemType = ItemType> {
  type: T;
  title: string;
  body?: string | null;
  url?: string | null;
  done?: boolean;
  payload?: PayloadByType[T];
  tags?: string[];
}

/** A partial update. Absent keys are left alone; `null` clears a nullable column. */
export interface ItemPatch<T extends ItemType = ItemType> {
  title?: string;
  body?: string | null;
  url?: string | null;
  done?: boolean;
  payload?: PayloadByType[T];
}
