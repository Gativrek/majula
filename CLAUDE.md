# CLAUDE.md — agent operating manual

Read `SPECS.md` first. It is the source of truth; this file is only how to operate the
repository. If the two disagree, the spec wins and this file gets fixed.

Precedence: `SPECS.md` > `CODESTYLE.md` > this file > preference.

---

## Standing rules

These are not suggestions. Each one is in the spec; the reference is given so it can be
checked rather than trusted.

1. **Spec first, code second.** To change behaviour, edit `SPECS.md`, then reconcile the
   code (§8). Never patch code and leave the spec stale.
2. **Never resolve an OPEN gate.** `SPECS.md` §9 and the `ROADMAP.md` gate register hold
   what is undecided. The owner decides; the closure is logged in `DECISIONS.md` before
   the work it blocks starts.
3. **No new dependency without an ADR** (§8). Prefer a platform API, then a small
   well-scoped package, then nothing.
4. **No new entity type without editing `SPECS.md` §4 first** (§8).
5. **Nothing from §1.1 gets built**, however convenient it looks mid-phase. No accounts,
   no sync, no calendar, no due dates, no charts, no finance, no settings for preferences
   the owner does not have.
6. **Every schema change is a numbered, forward-only migration** that bumps
   `schema_version` (§6). A shipped migration is never edited; a mistake is fixed by the
   next one.
7. **Re-verify the export/import round trip after every schema change** (ADR-003). It is
   the only thing between the owner and total data loss.
8. **Offline is the only mode** (§6). Verify in airplane mode, not by assertion.
9. **Write the module spec for the current step only**, never more than one step ahead
   (§7). Module specs live in `docs/modules/` and carry observable behaviour only.
10. **Acceptance is verified on a real Android device** (§6), not in a desktop browser.

---

## Commands

`JAVA_HOME` must point at a JDK for any Gradle command; on the owner's machine it is
already set to Android Studio's bundled JBR. The SDK path lives in
`android/local.properties`, which is not committed — recreate it on a fresh clone with
`sdk.dir=C:/Users/<user>/AppData/Local/Android/Sdk`, forward slashes, because a Java
properties file treats a backslash as an escape.

The `apk` script invokes `.\gradlew.bat` by explicit relative path. npm runs scripts
through `cmd.exe`, and Git Bash exports `NoDefaultCurrentDirectoryInExePath`, which stops
`cmd` finding an executable in the working directory, so both `./gradlew` and a bare
`gradlew` fail there.

| Command               | What it does                                                                  |
| --------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`         | Vite dev server. The UI renders; the database does not open (see below).      |
| `npm run typecheck`   | `tsc --noEmit`, strict.                                                       |
| `npm test`            | Node's test runner over `test/*.test.ts`.                                     |
| `npm run build`       | Typecheck, then bundle to `dist/`.                                            |
| `npm run format`      | Prettier over the repository.                                                 |
| `npm run sync`        | Build, then `cap sync android`. Run after any dependency change.              |
| `npm run apk`         | Sync, then `assembleDebug`. Output in `android/app/build/outputs/apk/debug/`. |
| `npm run install:apk` | `adb install -r` the debug APK onto the connected phone.                      |

**`npm run dev` cannot open the database.** SQLite is a native plugin (ADR-002), so in a
desktop browser `initialiseApp` throws and the app says so in a banner. That failure is
deliberate and must stay loud: it is not worked around with a browser fallback, because
acceptance runs on the device anyway (§6). Use the dev server for layout, the APK for
anything that touches data.

**Reading device logs.** Capacitor forwards the WebView console to logcat under the tag
`Capacitor/Console` — not `chromium`, which is what a WebView tags its own internal
messages with. Filtering on `chromium` hides everything this app logs.

```bash
adb logcat -d -s Capacitor/Console
```

`-d` dumps the buffer and exits. Without it, `logcat` tails the log forever and the
terminal looks hung; Ctrl+C ends it. Event names are stable and greppable
(`migration.start`, `export.done`, `purge.done`, `gate_v1.fts5`).

Capacitor only forwards console output when logging is enabled, which is the default for a
debug build (`loggingBehavior`). A release build would be silent.

---

## Layout

```
src/
  lib/        logger, errors, branded time types, id generation
  data/       every SQL statement; migrations; payload validation; the type union
  services/   orchestration the UI is allowed to call; filesystem; export/import
  ui/         Preact components and the theme
test/
  support/    the node:sqlite driver and in-memory file store used by tests only
docs/
  adr/        ADRs once they outgrow SPECS §3
  modules/    per-module acceptance criteria, written just before each module is built
android/      the Capacitor Android project
```

**Layering is one-directional: UI → service → data** (CODESTYLE §4). The UI never issues
SQL, never touches the filesystem and never parses a payload.

**Each module that opens full-screen has its own screen controller** — `RecipeScreens`,
`ReadingScreens`, `PlaceScreen`, `WorkoutScreens` — which owns that module's navigation
and back steps. `App.tsx` is the list and holds one piece of state for whatever is open
(`OpenScreenView.tsx`). A new module adds a controller and a case there; it does not grow
`App.tsx`, which is how it reached twice CODESTYLE §4's ceiling before it was split.

Two interfaces have exactly two implementations each — `SqlDriver` and `FileStore` — one
for the device and one for `node --test`. They exist so migrations, the item store and the
export round trip are testable without a phone, not to leave room for a third backend
(§1.1 item 3). Do not add one.

---

## Where the bodies are buried

- **`payload` is TEXT.** Static types do not survive `JSON.parse`. Everything coming out
  of that column goes through `src/data/payload.ts`; never cast (CODESTYLE §9).
- **`Timestamp` and `LocalDate` are branded** and deliberately incompatible. ISO 8601 UTC
  for rows, local `YYYY-MM-DD` for habit check-ins (§4.1).
- **`erasableSyntaxOnly` is on** so `node --test --experimental-strip-types` can run the
  TypeScript directly. That rules out constructor parameter properties and enums.
- **Soft delete retains attached files.** Only purge removes them (§4.1). A delete path
  that unlinks a file is a bug.
- **Every read filters `deleted_at IS NULL`** except the paths named for it:
  `listDeleted`, `purgeDeleted`, and `src/data/references.ts`, which resolves the
  exercises and routines a workout points at even after they are soft-deleted
  (CODESTYLE §10). References inside `payload` JSON are checked on write there too; a
  reference to a row that is gone entirely is logged as `workout.dangling_reference`
  and shown as "Unknown", never a blank screen.
- **`items_fts` is an external-content FTS5 table** over `items`, added by migration 002
  and kept in sync by triggers. It is never exported: it is derived, and the restore
  rebuilds it as rows go back in.
- **Export column names come from `src/data/tables.ts`**, never from the file being
  imported: no interpolation of data into SQL, including identifiers (CODESTYLE §10).
- **The device does not run your SQL script whole.**
  `@capacitor-community/sqlite` splits it on a semicolon followed by a newline, runs the
  pieces separately, then rejoins a trigger only by gluing a fragment that is exactly
  `END` onto the one fragment before it. A trigger body holding two statements therefore
  arrives broken. **Write every trigger on one line.** `node:sqlite`'s `exec()` has no
  such behaviour, so this class of bug passes every test unless it goes through
  `test/support/capacitor-splitter.ts` — which `test/migration-statements.test.ts` makes
  every migration do.
- **Startup failures name their stage** (`open`, `migrate`, `files`). Do not collapse them
  back into one message: a failing migration reported as "could not open the database, it
  runs on the phone not a browser" sends the search in exactly the wrong direction.

---

## Commits

- One logical change per commit, English, imperative, subject under ~72 characters.
- No commit leaves the build broken or the formatter unhappy. The pre-commit hook in
  `.githooks/` runs Prettier; enable it once per clone with
  `git config core.hooksPath .githooks`.
- Reformatting commits contain nothing but reformatting (CODESTYLE §2).

---

## Device verification

Everything below needs the phone. Nothing here can be closed from a desktop, and
`ROADMAP.md` Phase 1 is not done until it is. Log the outcome in `DECISIONS.md`.

The owner’s shell is **PowerShell 5.1**, which has no `&&`, no `??`, no ternary, and no
`grep`. Chain with `;` and a `$?` check, and filter with `Select-String`:

```bash
npm run apk; if ($?) { npm run install:apk }
```

**Phase 1 acceptance** — PASSED 2026-09-21. Re-run it after any schema change, because
the export/import round trip is what stands between the owner and total data loss:

1. Cold start to typing in quick capture, under ~2 s. Force-stop the app first, time it.
2. Capture a note, a to-do and a running-low item. Each appears
   under its own category icon.
3. Check the to-do off; it stays checked after a restart.
4. Delete one item. It leaves the list and appears under **Deleted**. Restore it.
5. Delete it again, then **Purge deleted**. It is gone from both views.
6. **Export**. Confirm `Documents/Majula/majula-export.json` and `Documents/Majula/pdfs/`
   exist from a file manager.
7. Uninstall the app, reinstall the APK, **Import**. The surviving data comes back and the
   purged row does not.

**Phase 2 acceptance** — PASSED 2026-09-23. Re-run checks 5 and 8 after any migration
that touches `items` or `items_fts`:

1. Search a word that appears only in an item's **body**, not its title. The item is found.
2. Search a prefix of a word — three letters of a longer one. The item is found while the
   word is still being typed.
3. Search two words. Only items carrying both come back.
4. Delete an item, then search a word from it. It is not found. Restore it and search
   again: it is found.
5. An item captured in Phase 1, before the index existed, is findable by a word in its
   body. This is the migration's rebuild, and it is the one that fails silently if wrong.
6. Each of **Notes**, **To-do**, **Contacts** and **Running low** shows only its own type.
7. Capture something with a tag via the **#** control. Its tag appears under **Search**, and
   tapping it shows that item.
8. **Backup → Export**, then reinstall and **Import**. Everything returns, and search still
   finds a word from a restored item — the index is rebuilt on import, not exported.

**Phase 3 acceptance** — PASSED 2026-10-13. Re-run checks 4–8 after anything that touches
dates or `habit_checks`:

1. Capture a habit with the **Habit** type. Its card reads `0 days` and has no done flag.
2. Tap its card. It reads `1 day` — singular — and the card is outlined in gold.
3. Tap it again the same day. It returns to `0`. This is a toggle, not an increment.
4. Check it three days running. It reads `3`.
5. The morning of the fourth day, before checking: it still reads `3`, not `0`.
6. Skip a whole day, then open the app: it reads `0`.
7. Force-stop and relaunch at any point: the number is unchanged.
8. **Change the device timezone** by several hours, in both directions, and reopen. No past
   check-in moves and the streak does not break. This is the case SPECS §4.4 singles out.
9. Delete a habit with a streak, restore it from **Deleted**: the streak comes back intact.
10. Delete it again and **Purge**: its check-ins go with it.
11. Export, reinstall, import: the streak reads the same.

**Phase 4 acceptance** — PASSED 2026-10-13, screen held awake on the device:

1. **The one that matters.** Open a recipe, put the phone down, and wait past the screen
   timeout. The screen stays lit. If a red line says the screen may sleep, it will not —
   read the reason and report it:

   ```bash
   adb logcat -d | Select-String kitchen.wake_lock
   ```

2. Close the recipe and wait past the timeout again. The screen sleeps normally.
3. With a recipe open, switch to another app and back. It still stays lit — the platform
   drops the hold on hide, and the app has to take it back.
4. Capture with the **Recipe** type: it opens straight into the editor.
5. Add an ingredient with only a name ("sal a gosto"). It saves, and shows with no number.
6. Type `1,5` as a quantity. It saves as one and a half.
7. Type `1.000` as a quantity. Save is refused with a message naming the ingredient.
8. Remove an ingredient from the middle of the list. The rows either side keep their own
   values.
9. The recipe reads comfortably at arm's length on a counter.
10. Close and Edit, Cancel and Save, are all reachable with the thumb of the hand holding
    the phone.
11. Export, reinstall, import: the recipe returns with every ingredient and step, and
    "sal a gosto" still has no number.

**Phase 5 acceptance** — PASSED 2026-10-14, in airplane mode (`ROADMAP.md` Phase 5, _done when_):

1. Capture with the **Reading** type. Tap the entry: title, URL, and **Attach PDF**.
2. Attach a PDF from the phone's storage. The page count appears.
3. **The one that matters.** In a file manager, **delete the original PDF**. Open the
   entry again: **Open PDF** still works. That is ADR-004's copy doing its job.
4. Read to page 3 or so, close the viewer, close the app, reopen: it opens on that page.
5. Tap Next quickly twice: it moves two pages, not one.
6. Rotate the phone: the page refits the new width without stretching.
7. Try to attach something that isn't a PDF: refused, nothing attached.
8. Back closes the viewer; back again closes the entry.
9. Delete the entry, restore it from **Deleted**: the PDF opens on the same page.
10. Delete it again and **Purge**: the entry and its PDF are gone.
11. Export, reinstall, import: the PDF comes back and opens on its saved page. Then try
    **Export without PDFs** and import that: the entry opens with a plain message that
    its PDF isn't on this phone, not a crash.

**Phase 6 acceptance** — PASSED 2026-10-13:

1. Capture with the **Place** type. Its screen opens with **Here** one tap away.
2. Tap **Here**. Android asks for location permission — this once, not at install.
3. **In airplane mode**, outdoors, tap **Here** on another place. A fix arrives, though the
   first one without signal may take a while, and the accuracy is shown.
4. Refuse the permission on a fresh install: the screen says so and changes nothing.
5. In a maps app, long-press a spot, copy its coordinates, paste them in, **Set**.
6. **Open in maps** opens the maps app on that spot, pin labelled with the place's name.
7. Rows show "location saved" for places that have one.
8. Export, reinstall, import: a place with coordinates and one without both come back.

**Phase 7 acceptance** — PASSED 2026-10-13:

1. Capture with the **Routine** type. The editor opens; back out of it: no routine exists.
2. Capture again, **Add exercise**, type a new name, tap **Create**. It joins the routine
   with 3 × 10 at 0 kg. Add a second exercise by picking an existing one. Save.
3. Open the routine, **Start workout**. Every set is pre-filled. Change one set’s reps
   and load, **Add set** (it copies the last), remove all of one exercise’s sets.
4. Press back mid-session: nothing is logged. Start again and **Save workout**: the log
   opens, and the removed exercise is not in it.
5. **The done-when.** Under **Workouts**, open the exercise you created and rename it. Open
   the past log: it shows the new name. The exercise’s own page lists its sets.
6. Delete that exercise. The past log still shows its name. **Purge**: it is kept, and
   the message says so. Delete the routine: the log says "from a deleted routine".
7. Delete the log too, then **Purge**: routine, exercise and log all go together.
8. Export, reinstall, import: routines, logs and history all come back.
9. Back from a log returns to the routine it came from; back again closes it.

**Owner’s requests of 2026-10-13** — PASSED 2026-10-14:

_PDF size and swiping_ (`reading-queue.md` 10, 11a, 15a–15d):

1. Open an A4 PDF upright. The page runs edge to edge and sits centred, not at the top.
2. **Trim margins**: the white side margins go and the text gets larger. A blank page,
   or one with thin margins, is shown whole.
3. **+** steps to 150%, 200%, 250%; the page scrolls sideways as well as down. **−**
   steps back.
4. Turn a page while zoomed: the new page starts at its top-left.
5. Close and reopen the PDF, and restart the app: trim and zoom are as you left them, and
   so is the page.
6. Rotate while zoomed: it refits without stretching.
7. Swipe left: next page. Swipe right: previous. Scrolling down a page never turns it.
8. Zoomed in, swipe left mid-page: it pans, no turn. Once at the right edge, swipe left
   again: next page. Likewise right from the left edge goes back (`reading-queue.md` 11a).

_Places from Google Maps_ (`places.md` 15–21):

1. In Google Maps, open a restaurant, **Share → Majula**. Majula opens on a new place
   named after it, with "Google Maps listing kept". Works from cold and with Majula open.
2. **Open in maps** opens that exact listing in Google Maps.
3. Share the same restaurant again: Majula opens the place it already has, no duplicate.
4. Share a web page from Chrome to Majula: a notice says it had no Google Maps link, and
   nothing is saved.
5. On a place, paste a link from **Share → Copy link** in Maps, **Set**: the link is kept.
6. **Clear** removes the coordinates and the link together.

**Back button** (`SPECS.md` §2.2, Back) — PASSED 2026-10-13. Undoes one step, never commits:

1. Capture with the **Recipe** type, type an ingredient, press back. You are on the list,
   and **no recipe exists** — not in the list, not under **Deleted**.
2. Open a recipe, tap Edit, change something, press back. You are back on the recipe and
   the change is gone. Back again closes it.
3. Save an edit with the Save button, then press back **once**. The recipe closes. (If it
   takes two presses, a spent history entry is being consumed — that is the bug the back
   stack exists to prevent.)
4. Open **Backup** or **Deleted**, press back. You are on the list.
5. On the list with nothing open, press back. The app leaves, as any Android app does.
6. On Import or Purge's confirmation dialog, press back. The dialog closes and nothing
   happens.

**Redesign of 2026-10-14** — OPEN (`DECISIONS.md`, 2026-10-14). Run after installing:

_The list_ (`SPECS.md` §2.2, The list):

1. The app opens on **To-do**. Habits sit above the row of eight icons as cards.
2. Tap a habit card: it reads one more day and is outlined in gold. Tap it again: undone.
3. Each icon shows only its own category. **Workouts** shows routines, logs and exercises,
   each with its type's icon.
4. Quick capture's placeholder follows the icon selected. The type button at its left
   opens every type; picking **Note** there switches the list to Notes too.
5. Swipe a row left: **Delete** shows. Tap the row: it closes. Scrolling the list up and
   down never opens a row. Swipe again and tap **Delete**: it moves to **Deleted**.
   Hold a row still instead: **Delete** shows the same way, and no text-selection menu
   appears. A line under the list says both.
6. Check a to-do off: it folds under **Done**, which opens and closes.
7. On **Notes**, search a word from a to-do: it is found. Back returns to Notes.
8. In search, tap a tag: the list shows that tag across categories. Back clears it.
9. **⋮** opens Deleted and Backup. Restore works from Deleted, **Purge deleted** sits under
   it, and Export and Import are under Backup.
   Backup shows two cards, Export and Import, and the export path under Documents.

_Screens_:

10. In a recipe's editor, tap the fourth star, then tap it again: three and a half stars.
    Save: kitchen mode shows them under the title. **Clear** and save: no stars at all.
11. Export, reinstall, import: the recipe's rating comes back.
12. Open a reading entry with a PDF: title and link first, then the page reached. The
    pencil edits the title; back cancels the edit without saving. **Continue on page N**
    opens on that page. The square beside it marks the entry read.
    Attach a large PDF (50 MB or so): the app stays open, shows its page count, and opens
    it. Turn a few pages; then export and import, and it still opens.
13. Open a place: **Location saved** leads, the coordinates are a small line, and copy puts
    them on the clipboard. **Here** and **Open in maps** sit at the bottom.
14. Start a workout: each exercise is a card of kg and reps. The × at the top discards the
    session and logs nothing.
    Open a routine: its exercises are a list with sets × reps · load, and **Edit** and
    **Start workout** are at the bottom. A past workout shows each exercise as a kg and reps
    grid. An exercise opens read-only; its pencil edits the name and cues.
    Change a set's load: that set is outlined in gold. Tap an exercise's name: it folds to
    one line such as `3 × 10 · 30 kg`. Save with it folded: its sets are still logged.

_Icon_:

15. The launcher shows the bonfire: gold on black, a glow under the flames. With themed
    icons turned on, it follows the wallpaper's colour and stays legible.
    Opening the app shows the bonfire on black, never a white screen, and the list's header
    has the bonfire in small beside the name.

_Tags and search marks_:

16. A tagged row shows its tags after its title: two at most, then `+N`.
17. Search a word that is only in a note's body: the result shows the words around it with
    the match marked in gold. Search a title word: the title has it marked.
18. Type a search quickly, then stop: the results are for what is in the field, not for
    something typed on the way.

_Capture_:

19. Tap **#** in quick capture and type `errands home `: each word becomes a pill with an ×.
    Your most-used tags show under it; tapping one adds it. Save: the item has them all,
    and the tag field is empty again.
20. The capture type button lists Note, Routine and so on, by what each creates.

**Permissions** — PASSED 2026-10-14 (`DECISIONS.md`, 2026-09-23). The APK declares no `INTERNET`, no
biometrics, only location. Re-check after any manifest or dependency change, since a
plugin can merge a permission back in:

1. The app starts and the list loads, with and without airplane mode.
2. Open a reading entry with a PDF: it renders.
3. On a place, **Here** still asks for location the first time and gets a fix.
4. The installed app requests nothing else:

   ```bash
   adb shell dumpsys package dev.majula.app | Select-String "permission"
   ```

**GATE V1 — CLOSED 2026-09-21: FTS5 is available.** Verified on the device, logged in
`DECISIONS.md`, and the probe that answered it has been deleted. Search takes the FTS5
path and there is no `LIKE` fallback to fall into.

If a future device ever lacks FTS5, migration 002 will fail at the `migrate` stage and
the startup banner will say so. That is a new decision and a new ADR, not a silent
fallback (CODESTYLE §6).
