import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ItemStore } from '../src/data/items.ts';
import { runMigrations } from '../src/data/migrations.ts';
import { purgeable, purgeDeleted } from '../src/data/purge.ts';
import { resolveReferences } from '../src/data/references.ts';
import { ValidationError } from '../src/lib/errors.ts';
import { setLogLevel } from '../src/lib/logger.ts';
import { openTestDatabase } from './support/driver-node.ts';

setLogLevel('error');

function sequentialIds(): () => string {
  let next = 0;
  return function nextId() {
    next += 1;
    return `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`;
  };
}

async function freshStore() {
  const driver = openTestDatabase();
  await runMigrations(driver);
  return { driver, store: new ItemStore(driver, { newId: sequentialIds() }) };
}

/** An exercise, a routine using it, and a log of that routine: the whole chain. */
async function chain(store: ItemStore) {
  const exercise = await store.create({ type: 'exercise', title: 'Bench press' });
  const routine = await store.create({
    type: 'routine',
    title: 'Upper A',
    payload: { exercises: [{ exercise_id: exercise.id, sets: 4, reps: 8, load_kg: 60 }] },
  });
  const log = await store.create({
    type: 'workout_log',
    title: 'Upper A — 2026-09-21',
    payload: {
      routine_id: routine.id,
      performed: [{ exercise_id: exercise.id, sets: [{ reps: 8, load_kg: 60 }] }],
    },
  });
  return { exercise, routine, log };
}

describe('purge fixed point', function fixedPointSuite() {
  const referrers = [
    { id: 'routine', targets: ['bench'] },
    { id: 'log', targets: ['routine', 'bench'] },
  ];

  it('holds back what a survivor points at', function heldBack() {
    // Only the exercise is deleted; the routine and log survive and use it.
    assert.deepEqual([...purgeable(new Set(['bench']), referrers)], []);
  });

  it('holds back a whole chain behind a surviving log', function chainHeld() {
    // Routine and exercise deleted, log alive: the log keeps the routine, and the kept
    // routine keeps the exercise in turn.
    assert.deepEqual([...purgeable(new Set(['routine', 'bench']), referrers)], []);
  });

  it('lets a chain go together when nothing surviving points into it', function chainGoes() {
    assert.deepEqual([...purgeable(new Set(['routine', 'bench', 'log']), referrers)].sort(), [
      'bench',
      'log',
      'routine',
    ]);
  });

  it('lets a routine and its exercise go when no log uses them', function noLog() {
    assert.deepEqual([...purgeable(new Set(['routine', 'bench']), [referrers[0]!])].sort(), [
      'bench',
      'routine',
    ]);
  });
});

describe('purging workout rows', function purgeSuite() {
  it('keeps a deleted exercise that a live routine and log still use', async function keepsExercise() {
    const { driver, store } = await freshStore();
    const { exercise } = await chain(store);

    await store.softDelete(exercise.id);
    const result = await purgeDeleted(driver);

    assert.equal(result.purgedRows, 0);
    assert.equal(result.keptReferenced, 1);
    assert.equal((await store.listDeleted()).length, 1, 'still recoverable under Deleted');
    await driver.close();
  });

  it('keeps a deleted routine that a live log still uses', async function keepsRoutine() {
    const { driver, store } = await freshStore();
    const { routine } = await chain(store);

    await store.softDelete(routine.id);
    const result = await purgeDeleted(driver);

    assert.equal(result.keptReferenced, 1);
    await driver.close();
  });

  it('purges the whole chain once the log itself is deleted', async function wholeChain() {
    const { driver, store } = await freshStore();
    const { exercise, routine, log } = await chain(store);

    for (const item of [log, routine, exercise]) await store.softDelete(item.id);
    const result = await purgeDeleted(driver);

    assert.equal(result.purgedRows, 3);
    assert.equal(result.keptReferenced, 0);
    const rows = await driver.query<{ count: number }>('SELECT COUNT(*) AS count FROM items');
    assert.equal(rows[0]?.count, 0);
    await driver.close();
  });

  it('still purges unrelated deleted rows alongside kept ones', async function mixed() {
    const { driver, store } = await freshStore();
    const { exercise } = await chain(store);
    const note = await store.create({ type: 'note', title: 'Throwaway' });

    await store.softDelete(exercise.id);
    await store.softDelete(note.id);
    const result = await purgeDeleted(driver);

    assert.equal(result.purgedRows, 1);
    assert.equal(result.keptReferenced, 1);
    await driver.close();
  });
});

describe('references on write (workout.md criterion 14)', function writeSuite() {
  it('refuses a routine naming an exercise that does not exist', async function missingExercise() {
    const { driver, store } = await freshStore();
    await assert.rejects(
      store.create({
        type: 'routine',
        title: 'Ghost routine',
        payload: {
          exercises: [
            {
              exercise_id: '99999999-9999-4999-8999-999999999999',
              sets: 3,
              reps: 10,
              load_kg: 0,
            },
          ],
        },
      }),
      ValidationError,
    );
    const rows = await driver.query<{ count: number }>('SELECT COUNT(*) AS count FROM items');
    assert.equal(rows[0]?.count, 0, 'the refused write rolled back');
    await driver.close();
  });

  it('refuses a routine pointing at something that is not an exercise', async function wrongType() {
    const { driver, store } = await freshStore();
    const note = await store.create({ type: 'note', title: 'Not an exercise' });
    await assert.rejects(
      store.create({
        type: 'routine',
        title: 'Confused',
        payload: { exercises: [{ exercise_id: note.id, sets: 3, reps: 10, load_kg: 0 }] },
      }),
      ValidationError,
    );
    await driver.close();
  });

  it('refuses a log whose routine_id is not a routine', async function logWrongRoutine() {
    const { driver, store } = await freshStore();
    const exercise = await store.create({ type: 'exercise', title: 'Squat' });
    await assert.rejects(
      store.create({
        type: 'workout_log',
        title: 'Orphan',
        payload: {
          routine_id: exercise.id,
          performed: [{ exercise_id: exercise.id, sets: [{ reps: 5, load_kg: 100 }] }],
        },
      }),
      ValidationError,
    );
    await driver.close();
  });

  it('lets a routine be re-saved while it holds an exercise deleted since', async function deletedTarget() {
    const { driver, store } = await freshStore();
    const { exercise, routine } = await chain(store);
    await store.softDelete(exercise.id);

    const renamed = await store.update(routine.id, { title: 'Upper A (old)' });
    assert.equal(renamed.title, 'Upper A (old)');
    await driver.close();
  });
});

describe('resolving references', function resolveSuite() {
  it('resolves a soft-deleted exercise, marked as deleted', async function deleted() {
    const { driver, store } = await freshStore();
    const { exercise } = await chain(store);
    await store.softDelete(exercise.id);

    const resolved = await resolveReferences(driver, [exercise.id]);
    assert.deepEqual(resolved.get(exercise.id), {
      id: exercise.id,
      type: 'exercise',
      title: 'Bench press',
      isDeleted: true,
    });
    await driver.close();
  });

  it('leaves an id with no row unresolved, rather than inventing one', async function absent() {
    const { driver } = await freshStore();
    const resolved = await resolveReferences(driver, ['99999999-9999-4999-8999-999999999999']);
    assert.equal(resolved.size, 0);
    await driver.close();
  });
});
