# Habit streak

`items.type = 'habit'`, with check-ins in `habit_checks` (`SPECS.md` §2.1, §4.2).

A habit is a name. Its state lives entirely in the check-in table, because a streak
cannot be derived from a single row.

**The streak count is the only statistic anywhere in the app** (`SPECS.md` §1.1 item 7).
No history chart, no completion rate, no calendar heatmap, no longest-ever streak.

## The streak

Per `SPECS.md` §4.4, and restated here because this is where it gets implemented:

> Current streak = the number of consecutive local dates, ending today — or yesterday, if
> today is not yet checked — present in `habit_checks` for that habit.

The "or yesterday" clause is what stops a streak reading zero all morning before the
habit has been done. A missed day resets to zero; there is no grace period.

Dates are local `YYYY-MM-DD`, never UTC instants. A check-in records the day it was made
in the timezone the phone was in, and that string never moves afterwards.

## Acceptance criteria

1. Quick capture with the **Habit** type creates a habit. It has no done flag: a habit is
   never finished.
2. A habit row shows its name and its current streak as a number. Nothing else.
3. Tapping the habit logs today. The streak increases immediately.
4. Tapping again on the same day **undoes** today's check-in. The streak returns to what
   it was. This is a toggle, not an increment.
5. A habit never checked reads `0`.
6. Checked on three consecutive days, it reads `3`.
7. Checked Monday and Wednesday but not Tuesday, it reads `1` on Wednesday.
8. Checked yesterday but not yet today, it still reads its full streak — not zero.
9. Checked neither yesterday nor today, it reads `0`, whatever came before.
10. All of the above survive a force-stop and relaunch.
11. **Across midnight:** a habit checked yesterday and left open on screen reads the same
    streak after midnight passes, and checking it then extends the streak rather than
    starting a new one.
12. **Across a timezone change:** changing the device timezone does not change any past
    check-in and does not break the streak. A check-in made on the 21st stays on the 21st.
13. Deleting a habit is a soft delete: it leaves the list, its check-ins are untouched,
    and restoring it restores the streak intact.
14. Purging a deleted habit removes its check-ins with it. No orphaned rows.
15. A habit is found by global search on its name.
16. Export and import carry `habit_checks`, and a restored habit reads the same streak.
17. All of the above work in airplane mode.

## Not in this module

- No rest days and no weekly-frequency habits (`SPECS.md` §4.4, GATE P2). The streak is a
  walk over consecutive dates, not a quota over a period.
- No back-dating and no editing past check-ins. One tap logs today; that is the interface.
- No reminders, no notifications, no scheduled prompts (`SPECS.md` §1.1 item 6).
- No charts, rates or records (`SPECS.md` §1.1 item 7).
- No archiving distinct from deleting.
