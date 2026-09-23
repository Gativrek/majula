import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ItemStore } from '../src/data/items.ts';
import { runMigrations } from '../src/data/migrations.ts';
import { setLogLevel } from '../src/lib/logger.ts';
import type { LocalDate } from '../src/lib/time.ts';
import { exportDatabase, importDatabase } from '../src/services/backup.ts';
import type { AppContext } from '../src/services/database.ts';
import {
  buildRoutine,
  buildSession,
  draftFromRoutine,
  newRoutineDraft,
  sessionFromRoutine,
} from '../src/services/workout-draft.ts';
import {
  addRoutine,
  createExercise,
  exerciseHistory,
  resolveNames,
  saveExerciseDetails,
  saveSession,
} from '../src/services/workouts.ts';
import { openTestDatabase } from './support/driver-node.ts';
import { createMemoryFileStore } from './support/files-memory.ts';

setLogLevel('error');

const TODAY = '2026-09-23' as LocalDate;
const nameOf = () => 'Bench press';

async function freshContext(files = createMemoryFileStore()): Promise<AppContext> {
  const driver = openTestDatabase();
  const schemaVersion = await runMigrations(driver);
  return { driver, items: new ItemStore(driver), files, schemaVersion };
}

describe('routine drafts', function routineDraftSuite() {
  const entry = { exerciseId: 'bench', sets: '4', reps: '8', load: '60' };

  it('builds a routine payload', function builds() {
    const result = buildRoutine({ title: 'Upper A', entries: [entry] }, nameOf);
    assert.deepEqual(result, {
      ok: true,
      title: 'Upper A',
      payload: { exercises: [{ exercise_id: 'bench', sets: 4, reps: 8, load_kg: 60 }] },
    });
  });

  it('accepts a decimal comma in the load, and zero for bodyweight', function loads() {
    const result = buildRoutine(
      {
        title: 'Upper A',
        entries: [
          { ...entry, load: '22,5' },
          { ...entry, load: '0' },
        ],
      },
      nameOf,
    );
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.deepEqual(
      result.payload.exercises.map((e) => e.load_kg),
      [22.5, 0],
    );
  });

  it('refuses an ambiguous load and names the exercise', function ambiguous() {
    const result = buildRoutine(
      { title: 'Upper A', entries: [{ ...entry, load: '1.000' }] },
      nameOf,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /Bench press/);
  });

  it('refuses a blank load rather than assuming zero', function blankLoad() {
    const result = buildRoutine({ title: 'Upper A', entries: [{ ...entry, load: ' ' }] }, nameOf);
    assert.equal(result.ok, false);
  });

  it('refuses fractional or zero sets and reps', function wholeNumbers() {
    for (const bad of [{ sets: '2.5' }, { sets: '0' }, { reps: 'dez' }, { reps: '-3' }]) {
      const result = buildRoutine({ title: 'Upper A', entries: [{ ...entry, ...bad }] }, nameOf);
      assert.equal(result.ok, false, JSON.stringify(bad));
    }
  });

  it('refuses a routine with no exercises or no name', function empty() {
    assert.equal(buildRoutine(newRoutineDraft('Upper A'), nameOf).ok, false);
    assert.equal(buildRoutine({ title: ' ', entries: [entry] }, nameOf).ok, false);
  });

  it('round-trips through the editor unchanged', function roundTrip() {
    const payload = { exercises: [{ exercise_id: 'bench', sets: 4, reps: 8, load_kg: 22.5 }] };
    const result = buildRoutine(draftFromRoutine('Upper A', payload), nameOf);
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.deepEqual(result.payload, payload);
  });
});

describe('session drafts', function sessionDraftSuite() {
  const routine = {
    id: 'routine',
    title: 'Upper A',
    payload: { exercises: [{ exercise_id: 'bench', sets: 3, reps: 8, load_kg: 60 }] },
  };

  it('pre-fills every set from the template', function prefill() {
    const draft = sessionFromRoutine(routine);
    assert.deepEqual(draft.entries[0]?.sets, [
      { reps: '8', load: '60' },
      { reps: '8', load: '60' },
      { reps: '8', load: '60' },
    ]);
  });

  it('logs what was actually done, titled with the routine and the date', function logs() {
    const draft = sessionFromRoutine(routine);
    draft.entries[0]!.sets[2] = { reps: '6', load: '57,5' };
    const result = buildSession(draft, TODAY, nameOf);
    assert.deepEqual(result, {
      ok: true,
      title: 'Upper A — 2026-09-23',
      payload: {
        routine_id: 'routine',
        performed: [
          {
            exercise_id: 'bench',
            sets: [
              { reps: 8, load_kg: 60 },
              { reps: 8, load_kg: 60 },
              { reps: 6, load_kg: 57.5 },
            ],
          },
        ],
      },
    });
  });

  it('leaves out an exercise whose sets were all removed', function skipped() {
    const draft = sessionFromRoutine({
      ...routine,
      payload: {
        exercises: [
          ...routine.payload.exercises,
          { exercise_id: 'row', sets: 3, reps: 10, load_kg: 40 },
        ],
      },
    });
    draft.entries[1]!.sets = [];
    const result = buildSession(draft, TODAY, nameOf);
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.deepEqual(
      result.payload.performed.map((p) => p.exercise_id),
      ['bench'],
    );
  });

  it('refuses a session with no sets at all', function nothing() {
    const draft = sessionFromRoutine(routine);
    draft.entries[0]!.sets = [];
    assert.equal(buildSession(draft, TODAY, nameOf).ok, false);
  });
});

describe('the exercise catalog', function catalogSuite() {
  it('returns the existing exercise instead of creating a duplicate', async function noDuplicate() {
    const context = await freshContext();
    const first = await createExercise(context, 'Bench press');
    const again = await createExercise(context, '  bench press ');
    assert.ok(first.ok && again.ok);
    if (!first.ok || !again.ok) return;
    assert.equal(again.exercise.id, first.exercise.id);
    await context.driver.close();
  });

  it('refuses a rename onto another exercise’s name', async function renameClash() {
    const context = await freshContext();
    const bench = await createExercise(context, 'Bench press');
    await createExercise(context, 'Squat');
    assert.ok(bench.ok);
    if (!bench.ok) return;
    const result = await saveExerciseDetails(context, bench.exercise.id, {
      name: 'squat',
      cues: '',
    });
    assert.equal(result.ok, false);
    await context.driver.close();
  });

  it('shows "Unknown exercise" for a reference to a row that is gone', async function dangling() {
    const context = await freshContext();
    const nameOfId = await resolveNames(context, ['99999999-9999-4999-8999-999999999999'], 'test');
    const resolved = nameOfId('99999999-9999-4999-8999-999999999999');
    assert.equal(resolved.name, 'Unknown exercise');
    assert.equal(resolved.isUnknown, true);
    await context.driver.close();
  });
});

/**
 * ROADMAP Phase 7, done when: an exercise is created, used in a routine, performed,
 * logged, renamed in the catalog, and the rename is visible in the past log; and the
 * whole lot survives an export/import round trip.
 */
describe('the Phase 7 done-when', function doneWhenSuite() {
  it('carries a rename into a past log, and through a backup', async function doneWhen() {
    const files = createMemoryFileStore();
    const context = await freshContext(files);

    // Created, from the picker.
    const created = await createExercise(context, 'Supino');
    assert.ok(created.ok);
    if (!created.ok) return;
    const exerciseId = created.exercise.id;

    // Used in a routine.
    const added = await addRoutine(context, {
      title: 'Upper A',
      entries: [{ exerciseId, sets: '2', reps: '8', load: '60' }],
    });
    assert.ok(added.ok);
    if (!added.ok) return;

    // Performed, and logged.
    const session = sessionFromRoutine(added.routine);
    const saved = await saveSession(context, session);
    assert.ok(saved.ok);
    if (!saved.ok) return;

    // Renamed in the catalog.
    const renamed = await saveExerciseDetails(context, exerciseId, {
      name: 'Bench press',
      cues: 'Shoulder blades back.',
    });
    assert.ok(renamed.ok);

    // The rename is visible in the past log: the log holds the id, not the name.
    const log = saved.log;
    const exerciseInLog = log.payload.performed[0]?.exercise_id ?? '';
    const nameInLog = await resolveNames(context, [exerciseInLog], log.id);
    assert.equal(nameInLog(exerciseInLog).name, 'Bench press');

    // And history lists the sets under the new name's exercise.
    const history = await exerciseHistory(context, exerciseId);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.sets.length, 2);

    // The whole lot survives an export/import round trip onto a fresh install.
    await exportDatabase(context.driver, files);
    await context.driver.close();

    const restored = await freshContext(files);
    await importDatabase(restored.driver, files);
    const nameAfter = await resolveNames(restored, [exerciseInLog], log.id);
    assert.equal(nameAfter(exerciseInLog).name, 'Bench press');
    assert.equal((await exerciseHistory(restored, exerciseId)).length, 1);
    await restored.driver.close();
  });
});
