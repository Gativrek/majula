# To-do

`items.type = 'todo'`. Text and a done flag (`SPECS.md` §2.1).

**There is no due date.** Not in the schema, not in the payload, not in the UI, not as a
tag convention the app understands. GATE D8 closed on this: a due date invites a
sort-by-date view, then a due-today view, then reminders, which is the calendar
`SPECS.md` §1.1 item 6 forbids.

## Acceptance criteria

1. Quick capture with the **To-do** chip creates a to-do with `done = 0`.
2. A to-do row carries a check control in the **lower half of the screen's reach** — the
   row's own leading control, not a menu behind a long press.
3. Tapping the check toggles `done`. The change is visible immediately and survives a
   force-stop and relaunch.
4. A done to-do stays in the list, visibly struck through. It is not hidden, not moved to
   a separate section, and not deleted.
5. Toggling done does not change the title, the body or the tags.
6. A to-do is found by global search whether or not it is done.
7. Nowhere in the app does a to-do display, accept or store a date other than the
   `created_at` / `updated_at` every row carries.
8. A soft-deleted to-do leaves the list and search, and returns on restore with its done
   flag intact.

## Not in this module

- No due dates, no reminders, no notifications, no recurrence (`SPECS.md` §1.1 item 6).
- No priorities, no sub-tasks, no ordering beyond newest first.
- No "clear completed" bulk action. Deleting is per-row; purge is global (§2.2).
