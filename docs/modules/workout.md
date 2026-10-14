# Workout routine and exercise catalog

Three types over `items` (`SPECS.md` §2.1, §4.3), no new table:

| Type | Is | Payload |
|---|---|---|
| `exercise` | A catalog entry. Title is the name; body holds form cues. | none |
| `routine` | A template: which exercises, how many sets, reps, load. | `exercises[{exercise_id, sets, reps, load_kg}]` |
| `workout_log` | One session actually performed. | `routine_id`, `performed[{exercise_id, sets[{reps, load_kg}]}]` |

Exercises are **referenced by id, never copied by name** (§4.3, ACCEPTED 2026-09-21).
Renaming an exercise therefore renames it in every routine and every past log at once.

## References — the two questions this spec owed

`SPECS.md` §4.1: SQLite cannot enforce a reference inside JSON, so the data layer does,
on write and on read. The owner decided both questions on 2026-09-23.

**Deleting an exercise that routines or logs still use.** The delete is an ordinary soft
delete: the exercise leaves the catalog and the picker. Routines and past logs keep
showing its name, because the row is still there. **Purge skips any exercise still
referenced** by a routine or log that is itself not being purged, and says how many it
kept. Without that, purge would leave past workouts pointing at nothing.

**Deleting a routine that has logs.** The logs keep working: each stores its own
exercises and sets, and uses the routine only for its name. A log whose routine is
deleted shows "from a deleted routine". **Purge skips a routine still referenced by a
log** that is not being purged, by the same rule.

Purge takes whole chains together: a deleted routine and a deleted exercise used only by
it are purged in the same run. What survives the purge decides what is still referenced.

## Acceptance criteria

**The catalog**

1. **Exercises** is a type view. Tapping one opens it: name, form cues, and its history.
2. Renaming an exercise changes its name in every routine and every past log.
3. An exercise's **history** is a plain list of past sets, newest session first: the
   date, then each set's reps and load. No charts, no records, no totals, no progression
   (`SPECS.md` §1.1 item 7).

**Routines**

4. Quick capture with the **Routine** type opens the routine editor with the typed name.
   Like a recipe, nothing is written until Save; back or Cancel creates nothing.
5. Exercises are added through a **picker**, which lists live exercises by name, narrows
   as the owner types, and offers **Create "…"** when nothing matches exactly. Creating
   from the picker adds the exercise to the catalog and to the routine in one step.
6. Each exercise in a routine has sets, reps and load in kg. Load accepts `22,5` or
   `22.5`; an ambiguous value like `1.000` is refused, as in the cookbook. `0` is a real
   load, for bodyweight exercises. Sets and reps are whole numbers above zero.
7. An exercise can be removed from a routine; the rest keep their order.
8. A routine opens to a read view with **Start workout** and **Edit** at the thumb.

**Performing and logging**

9. **Start workout** opens a session with every exercise of the routine and its sets
   pre-filled from the template. Reps and load can be changed per set; sets can be added
   and removed.
10. **Save** writes one `workout_log`, titled with the routine's name and the local date.
    **Back or Cancel writes nothing**: a session is an edit in progress (`SPECS.md` §2.2).
11. **Workouts** is a type view of logs, newest first. A log shows each exercise's
    current name and the sets performed.
12. A log whose exercise was later deleted still shows that exercise's name. A log whose
    routine was deleted says "from a deleted routine".
13. A reference to a row that no longer exists at all — only possible from a damaged or
    hand-edited import — shows "Unknown exercise" and is logged as
    `workout.dangling_reference`. It never blanks the screen.

**Integrity on write**

14. A routine or log cannot be saved referring to an id that is not an exercise, or a log
    to a `routine_id` that is not a routine. Deleted-but-not-purged targets are allowed:
    an existing routine may still hold an exercise deleted since.

**Everything else**

15. Soft delete, restore, purge, export and import work as for every other item, subject
    to the purge rules above.
16. **Done when** (`ROADMAP.md` Phase 7): an exercise is created, used in a routine,
    performed, logged, renamed in the catalog, and the rename shows in the past log; and
    all of it survives an export/import round trip.
17. All of the above works in airplane mode.

## Not in this module

- No charts, progression graphs, personal records, volume totals or estimated maxima
  (`SPECS.md` §1.1 item 7). History is a list.
- No timers, rest countdowns or notifications.
- No reordering exercises within a routine in v1; they keep the order they were added.
- No sessions without a routine: `routine_id` is required by §4.3. A one-off session is a
  routine used once.
- No plate calculators or unit conversion. Loads are kilograms.
