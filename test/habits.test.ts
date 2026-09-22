import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listChecks, stateFor, toggleToday } from '../src/data/habits.ts';
import { ItemStore } from '../src/data/items.ts';
import { runMigrations } from '../src/data/migrations.ts';
import { purgeDeleted } from '../src/data/purge.ts';
import { setLogLevel } from '../src/lib/logger.ts';
import type { Clock } from '../src/lib/time.ts';
import { openTestDatabase } from './support/driver-node.ts';

setLogLevel('error');

/** A clock the test moves by hand, so "today" is never the day the suite happens to run. */
function fixedClock(iso: string): { clock: Clock; set: (next: string) => void } {
  let current = iso;
  return {
    clock: () => new Date(current),
    set: (next: string) => {
      current = next;
    },
  };
}

function sequentialIds(): () => string {
  let next = 0;
  return function nextId() {
    next += 1;
    return `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`;
  };
}

async function freshHabit(clock: Clock) {
  const driver = openTestDatabase();
  await runMigrations(driver);
  const store = new ItemStore(driver, { clock, newId: sequentialIds() });
  const habit = await store.create({ type: 'habit', title: 'Stretch' });
  return { driver, store, habit };
}

describe('habit check-ins', function habitSuite() {
  it('starts at zero and unchecked', async function initial() {
    const { clock } = fixedClock('2026-09-21T09:00:00');
    const { driver, habit } = await freshHabit(clock);
    assert.deepEqual(await stateFor(driver, habit.id, clock), { checkedToday: false, streak: 0 });
    await driver.close();
  });

  it('logs today on the first tap', async function check() {
    const { clock } = fixedClock('2026-09-21T09:00:00');
    const { driver, habit } = await freshHabit(clock);
    assert.deepEqual(await toggleToday(driver, habit.id, clock), {
      checkedToday: true,
      streak: 1,
    });
    await driver.close();
  });

  it('undoes today on a second tap the same day', async function uncheck() {
    const { clock } = fixedClock('2026-09-21T09:00:00');
    const { driver, habit } = await freshHabit(clock);
    await toggleToday(driver, habit.id, clock);
    assert.deepEqual(await toggleToday(driver, habit.id, clock), {
      checkedToday: false,
      streak: 0,
    });
    assert.deepEqual(await listChecks(driver, habit.id), [], 'the undo removes the row');
    await driver.close();
  });

  it('builds a streak over consecutive days', async function consecutive() {
    const time = fixedClock('2026-09-19T09:00:00');
    const { driver, habit } = await freshHabit(time.clock);

    await toggleToday(driver, habit.id, time.clock);
    time.set('2026-09-20T09:00:00');
    await toggleToday(driver, habit.id, time.clock);
    time.set('2026-09-21T09:00:00');
    const state = await toggleToday(driver, habit.id, time.clock);

    assert.equal(state.streak, 3);
    await driver.close();
  });

  it('resets after a skipped day', async function skipped() {
    const time = fixedClock('2026-09-19T09:00:00');
    const { driver, habit } = await freshHabit(time.clock);

    await toggleToday(driver, habit.id, time.clock);
    // The 20th passes untouched.
    time.set('2026-09-21T09:00:00');
    assert.equal((await stateFor(driver, habit.id, time.clock)).streak, 0);
    await driver.close();
  });

  it('holds the streak overnight before today is checked', async function overnight() {
    const time = fixedClock('2026-09-20T23:59:00');
    const { driver, habit } = await freshHabit(time.clock);
    await toggleToday(driver, habit.id, time.clock);

    time.set('2026-09-21T00:01:00');
    const state = await stateFor(driver, habit.id, time.clock);
    assert.equal(state.checkedToday, false);
    assert.equal(state.streak, 1, 'midnight must not zero a streak that is merely not yet done');
    await driver.close();
  });

  it('records the local day, not the UTC one', async function localDay() {
    // Late evening local time on the 21st. In UTC this instant is already the 22nd for
    // any timezone east of it, which is exactly the confusion §4.1 separates the types
    // to prevent.
    const { clock } = fixedClock('2026-09-21T23:30:00');
    const { driver, habit } = await freshHabit(clock);
    await toggleToday(driver, habit.id, clock);

    const [recorded] = await listChecks(driver, habit.id);
    assert.equal(recorded, '2026-09-21');
    await driver.close();
  });

  it('cannot double-count the same day', async function idempotent() {
    const { clock } = fixedClock('2026-09-21T09:00:00');
    const { driver, habit } = await freshHabit(clock);
    await driver.run('INSERT INTO habit_checks (habit_id, date) VALUES (?, ?)', [
      habit.id,
      '2026-09-21',
    ]);
    await assert.rejects(
      driver.run('INSERT INTO habit_checks (habit_id, date) VALUES (?, ?)', [
        habit.id,
        '2026-09-21',
      ]),
      'the composite primary key is what makes a check-in a fact rather than a count',
    );
    await driver.close();
  });

  it('keeps check-ins through a soft delete and restore', async function softDelete() {
    const time = fixedClock('2026-09-20T09:00:00');
    const { driver, store, habit } = await freshHabit(time.clock);
    await toggleToday(driver, habit.id, time.clock);
    time.set('2026-09-21T09:00:00');
    await toggleToday(driver, habit.id, time.clock);

    await store.softDelete(habit.id);
    assert.equal((await listChecks(driver, habit.id)).length, 2, 'a soft delete keeps the facts');

    await store.restore(habit.id);
    assert.equal((await stateFor(driver, habit.id, time.clock)).streak, 2);
    await driver.close();
  });

  it('takes check-ins with it on purge', async function purge() {
    const { clock } = fixedClock('2026-09-21T09:00:00');
    const { driver, store, habit } = await freshHabit(clock);
    await toggleToday(driver, habit.id, clock);

    await store.softDelete(habit.id);
    await purgeDeleted(driver);

    assert.deepEqual(
      await listChecks(driver, habit.id),
      [],
      'ON DELETE CASCADE must leave no orphaned check-ins behind',
    );
    await driver.close();
  });
});
