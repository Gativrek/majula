import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { currentStreak } from '../src/data/streak.ts';
import type { LocalDate } from '../src/lib/time.ts';

const on = (...dates: string[]): LocalDate[] => dates as LocalDate[];
const day = (date: string): LocalDate => date as LocalDate;

/**
 * SPECS §4.4 says the walk is trivial and the calendar is not. These are the calendar.
 */
describe('streak walk', function streakSuite() {
  it('reads zero when nothing has been checked', function never() {
    assert.equal(currentStreak(on(), day('2026-09-21')), 0);
  });

  it('reads three for three consecutive days ending today', function three() {
    assert.equal(currentStreak(on('2026-09-19', '2026-09-20', '2026-09-21'), day('2026-09-21')), 3);
  });

  it('counts the run through yesterday when today is not yet checked', function notYetToday() {
    assert.equal(
      currentStreak(on('2026-09-19', '2026-09-20'), day('2026-09-21')),
      2,
      'a streak must not read zero all morning before the habit is done',
    );
  });

  it('resets to zero when a whole day was missed', function missed() {
    assert.equal(
      currentStreak(on('2026-09-18', '2026-09-19'), day('2026-09-21')),
      0,
      'the day before yesterday is not a grace period',
    );
  });

  it('counts only the run ending now, not the longest run ever', function onlyCurrent() {
    assert.equal(
      currentStreak(
        on('2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-20', '2026-09-21'),
        day('2026-09-21'),
      ),
      2,
    );
  });

  it('ignores check-ins in the future', function future() {
    assert.equal(currentStreak(on('2026-09-21', '2026-09-25'), day('2026-09-21')), 1);
  });

  it('is unaffected by the order the dates arrive in', function unordered() {
    assert.equal(currentStreak(on('2026-09-21', '2026-09-19', '2026-09-20'), day('2026-09-21')), 3);
  });

  it('walks across a month boundary', function monthBoundary() {
    assert.equal(currentStreak(on('2026-08-30', '2026-08-31', '2026-09-01'), day('2026-09-01')), 3);
  });

  it('walks across a year boundary', function yearBoundary() {
    assert.equal(currentStreak(on('2025-12-30', '2025-12-31', '2026-01-01'), day('2026-01-01')), 3);
  });

  it('walks across a leap day', function leapDay() {
    assert.equal(currentStreak(on('2028-02-28', '2028-02-29', '2028-03-01'), day('2028-03-01')), 3);
  });

  it('survives a midnight rollover without breaking the streak', function midnight() {
    const checked = on('2026-09-19', '2026-09-20', '2026-09-21');

    // Late on the 21st, with today checked.
    assert.equal(currentStreak(checked, day('2026-09-21')), 3);
    // One minute later it is the 22nd and nothing has been checked yet. The streak must
    // hold at three, not drop to zero and not silently become four.
    assert.equal(currentStreak(checked, day('2026-09-22')), 3);
    // Checking on the 22nd extends it rather than starting again.
    assert.equal(currentStreak([...checked, day('2026-09-22')], day('2026-09-22')), 4);
  });

  it('does not break when the device timezone changes', function timezoneChange() {
    // Check-ins are stored as local date strings, so they do not move when the device
    // does. Whatever timezone the phone is in, these are still three consecutive days.
    const checked = on('2026-09-19', '2026-09-20', '2026-09-21');
    assert.equal(currentStreak(checked, day('2026-09-21')), 3);

    // Flying east far enough to land on the next calendar day: the run through
    // "yesterday" still counts.
    assert.equal(currentStreak(checked, day('2026-09-22')), 3);

    // Flying west far enough to land on the previous one: today is checked, and the
    // streak reads the run ending there rather than zero.
    assert.equal(currentStreak(checked, day('2026-09-20')), 2);
  });
});
