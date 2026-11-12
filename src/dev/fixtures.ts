/**
 * Stand-in rows for the layout harness. Dev-only: nothing here is imported by the app
 * (see `src/dev/harness.tsx` for why this exists and what it is not).
 *
 * These are hand-written `Item`s, not database reads, so the harness needs no driver.
 * They lean deliberately long — the owner's real titles are short, and a layout that
 * only survives short titles is the bug this harness is for.
 */

import type { Item, ItemOfType } from '../data/types.ts';
import type { HabitState } from '../services/habits.ts';
import type { ResolvedName } from '../services/workouts.ts';
import type { Timestamp } from '../lib/time.ts';

const AT = '2026-11-12T09:00:00.000Z' as Timestamp;

function base<T extends Item['type']>(
  id: string,
  type: T,
  title: string,
): Omit<ItemOfType<T>, 'payload'> {
  return {
    id,
    type,
    title,
    body: null,
    url: null,
    done: false,
    createdAt: AT,
    updatedAt: AT,
    deletedAt: null,
  };
}

export const todos: Item[] = [
  { ...base('t1', 'todo', 'Ligar para o dentista'), payload: {} },
  {
    ...base('t2', 'todo', 'Renovar o seguro do carro antes do fim do mês e guardar o comprovativo'),
    payload: {},
  },
  { ...base('t4', 'todo', 'Levar o casaco à lavandaria'), payload: {} },
  { ...base('t3', 'todo', 'Comprar pilhas'), done: true, payload: {} },
  { ...base('t5', 'todo', 'Pagar a conta da luz'), done: true, payload: {} },
  { ...base('t6', 'todo', 'Marcar a revisão do carro'), done: true, payload: {} },
];

export const groceries: Item[] = [
  { ...base('g10', 'grocery', 'Azeite'), payload: {} },
  { ...base('g11', 'grocery', 'Café em grão'), payload: {} },
  { ...base('g12', 'grocery', 'Detergente da loiça'), done: true, payload: {} },
];

export const contacts: Item[] = [
  { ...base('c1', 'contact', 'Dra. Marta — dentista'), body: '+351 21 000 0000', payload: {} },
  { ...base('c2', 'contact', 'Canalizador (o do prédio)'), payload: {} },
];

/** A row typed into quick capture, for the types whose payload is empty. */
export function captured(
  id: string,
  type: 'todo' | 'note' | 'grocery' | 'contact',
  title: string,
): Item {
  switch (type) {
    case 'todo':
      return { ...base(id, 'todo', title), payload: {} };
    case 'note':
      return { ...base(id, 'note', title), payload: {} };
    case 'grocery':
      return { ...base(id, 'grocery', title), payload: {} };
    case 'contact':
      return { ...base(id, 'contact', title), payload: {} };
  }
}

export const notes: Item[] = [
  {
    ...base('n1', 'note', 'Ideias para o jardim'),
    body: 'Manjericão na janela da cozinha.\nTomate só depois de março.\nO alecrim aguenta o frio.',
    payload: {},
  },
  {
    ...base('n2', 'note', 'Supercalifragilisticexpialidocious'),
    body: 'A single unbroken word in the title, to see what the row does with it.',
    payload: {},
  },
];

export const habits: ItemOfType<'habit'>[] = [
  { ...base('h1', 'habit', 'Correr'), payload: {} },
  { ...base('h2', 'habit', 'Ler antes de dormir'), payload: {} },
  { ...base('h3', 'habit', 'Alongamentos da manhã'), payload: {} },
  { ...base('h4', 'habit', 'Água'), payload: {} },
  { ...base('h5', 'habit', 'Diário'), payload: {} },
];

export const habitStates = new Map<string, HabitState>([
  ['h1', { checkedToday: true, streak: 12 }],
  ['h2', { checkedToday: false, streak: 3 }],
  ['h3', { checkedToday: true, streak: 1 }],
  ['h4', { checkedToday: false, streak: 0 }],
  ['h5', { checkedToday: true, streak: 147 }],
]);

export const recipe: ItemOfType<'recipe'> = {
  ...base('r1', 'recipe', 'Arroz de pato à moda antiga'),
  payload: {
    servings: 4,
    rating: 7,
    ingredients: [
      { qty: 1, unit: 'un', name: 'pato' },
      { qty: 300, unit: 'g', name: 'arroz carolino' },
      { qty: 1, unit: 'un', name: 'chouriço de carne' },
      { name: 'sal a gosto' },
      { qty: 1.5, unit: 'dl', name: 'vinho branco seco da região' },
    ],
    steps: [
      'Cozer o pato em água temperada com o chouriço, a cebola e o louro, até a carne se soltar dos ossos.',
      'Desfiar o pato.',
      'Refogar a cebola, juntar o arroz e o caldo da cozedura na proporção de dois para um.',
      'Levar ao forno a 200 °C até ganhar crosta.',
    ],
  },
};

export const reading: ItemOfType<'reading'> = {
  ...base('g1', 'reading', 'Structure and Interpretation of Computer Programs'),
  url: 'https://mitpress.mit.edu/sites/default/files/sicp/full-text/book/book.html',
  payload: { pdf_path: 'pdfs/g1.pdf', page_count: 657, last_page: 94 },
};

export const place: ItemOfType<'place'> = {
  ...base('p1', 'place', 'Tasca do Zé — aquela da rua de trás'),
  body: 'Fecha à segunda. Pedir o polvo.',
  url: 'https://maps.app.goo.gl/abcdefghijk',
  payload: { lat: 38.736946, lon: -9.142685 },
};

export const routine: ItemOfType<'routine'> = {
  ...base('ro1', 'routine', 'Puxar — segunda e quinta'),
  payload: {
    exercises: [
      { exercise_id: 'e1', sets: 3, reps: 10, load_kg: 60 },
      { exercise_id: 'e2', sets: 4, reps: 8, load_kg: 32.5 },
      { exercise_id: 'e3', sets: 3, reps: 12, load_kg: 0 },
    ],
  },
};

export const workoutLog: ItemOfType<'workout_log'> = {
  ...base('w1', 'workout_log', 'Puxar — segunda e quinta'),
  payload: {
    routine_id: 'ro1',
    performed: [
      {
        exercise_id: 'e1',
        sets: [
          { reps: 10, load_kg: 60 },
          { reps: 10, load_kg: 60 },
          { reps: 8, load_kg: 62.5 },
        ],
      },
      {
        exercise_id: 'e2',
        sets: [
          { reps: 8, load_kg: 32.5 },
          { reps: 8, load_kg: 32.5 },
        ],
      },
    ],
  },
};

export const exercise: ItemOfType<'exercise'> = {
  ...base('e1', 'exercise', 'Remada curvada com barra'),
  body: 'Costas direitas. Puxar com os cotovelos, não com as mãos.',
  payload: {},
};

/**
 * `e3` is deliberately a deleted exercise and anything unlisted resolves as unknown, so
 * both of the degraded states a workout screen has to show are on screen somewhere
 * (CLAUDE.md: a dangling reference reads "Unknown", never a blank).
 */
const NAMES: Record<string, string> = {
  ro1: 'Puxar — segunda e quinta',
  e1: 'Remada curvada com barra',
  e2: 'Elevações pronadas com peso adicional',
  e3: 'Face pull',
};

export function nameOf(id: string): ResolvedName {
  const name = NAMES[id];
  if (name === undefined)
    return { id, name: 'Unknown exercise', isDeleted: false, isUnknown: true };
  return { id, name, isDeleted: id === 'e3', isUnknown: false };
}

export const knownTags = [
  { tag: 'casa', count: 18 },
  { tag: 'trabalho', count: 11 },
  { tag: 'compras', count: 7 },
  { tag: 'recados', count: 4 },
];

export const tagsByItem = new Map<string, readonly string[]>([
  ['t1', ['saúde']],
  ['t2', ['casa', 'trabalho', 'papelada', 'urgente']],
  ['n1', ['casa']],
]);

/** A reading entry already marked read, so the Reading list has a Done fold too. */
export const readingDone: ItemOfType<'reading'> = {
  ...base('g2', 'reading', 'The Pragmatic Programmer'),
  done: true,
  payload: { page_count: 352, last_page: 352 },
};

/** Every row the list scene starts from; categories filter it by type, as the app does. */
export function allItems(): Item[] {
  return [
    ...todos,
    ...notes,
    ...groceries,
    ...contacts,
    reading,
    readingDone,
    recipe,
    place,
    routine,
    workoutLog,
    exercise,
  ];
}
