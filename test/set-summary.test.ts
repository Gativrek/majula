import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isChanged, summariseSets } from '../src/ui/set-summary.ts';

describe('a folded exercise in a workout', function summarySuite() {
  it('reads sets, reps and load when every set matches', function same() {
    const set = { reps: '10', load: '30' };
    assert.equal(summariseSets([set, set, set]), '3 × 10 · 30 kg');
  });

  it('drops the load when it varies, and the reps when they vary', function varied() {
    assert.equal(
      summariseSets([
        { reps: '10', load: '60' },
        { reps: '10', load: '62,5' },
      ]),
      '2 × 10',
    );
    assert.equal(
      summariseSets([
        { reps: '10', load: '60' },
        { reps: '8', load: '60' },
      ]),
      '2 sets',
    );
  });

  it('says one set, and skipped for none', function edges() {
    assert.equal(summariseSets([{ reps: '5', load: '' }]), '1 × 5');
    assert.equal(summariseSets([]), 'Skipped');
  });
});

describe('a set changed from the routine', function changedSuite() {
  const planned = { reps: '10', load: '60' };

  it('is unchanged when it reads as planned, spaces aside', function same() {
    assert.equal(isChanged({ reps: ' 10', load: '60 ' }, planned), false);
  });

  it('is changed when reps or load differ, or the set was added', function changed() {
    assert.equal(isChanged({ reps: '8', load: '60' }, planned), true);
    assert.equal(isChanged({ reps: '10', load: '62,5' }, planned), true);
    assert.equal(isChanged({ reps: '10', load: '60' }, null), true);
  });
});
