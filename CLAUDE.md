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

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server. The UI renders; the database does not open (see below). |
| `npm run typecheck` | `tsc --noEmit`, strict. |
| `npm test` | Node's test runner over `test/*.test.ts`. |
| `npm run build` | Typecheck, then bundle to `dist/`. |
| `npm run format` | Prettier over the repository. |
| `npm run sync` | Build, then `cap sync android`. Run after any dependency change. |
| `npm run apk` | Sync, then `assembleDebug`. Output in `android/app/build/outputs/apk/debug/`. |
| `npm run install:apk` | `adb install -r` the debug APK onto the connected phone. |

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
- **Every read filters `deleted_at IS NULL`** except the two paths named for it,
  `listDeleted` and `purgeDeleted`.
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
2. Capture a note, a to-do and a running-low item. All three appear in the list.
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
7. Capture something with a tag via the **#** control. Its tag appears as a chip, and
   tapping the chip shows that item.
8. **Backup → Export**, then reinstall and **Import**. Everything returns, and search still
   finds a word from a restored item — the index is rebuilt on import, not exported.

**Phase 3 acceptance** (`ROADMAP.md` Phase 3, *done when*), in airplane mode:

1. Capture a habit with the **Habit** chip. It reads `Streak 0 days` and has no done flag.
2. Tap it. It reads `Streak 1 day` — singular — and the row is outlined in gold.
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

**Phase 4 acceptance** (`ROADMAP.md` Phase 4, *done when*), in airplane mode:

1. **The one that matters.** Open a recipe, put the phone down, and wait past the screen
   timeout. The screen stays lit. If a red line says the screen may sleep, it will not —
   read the reason and report it:

   ```bash
   adb logcat -d | Select-String kitchen.wake_lock
   ```

2. Close the recipe and wait past the timeout again. The screen sleeps normally.
3. With a recipe open, switch to another app and back. It still stays lit — the platform
   drops the hold on hide, and the app has to take it back.
4. Capture with the **Recipe** chip: it opens straight into the editor.
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

**Back button** (`SPECS.md` §2.2, Back) — undoes one step, never commits:

1. Capture with the **Recipe** chip, type an ingredient, press back. You are on the list,
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

**GATE V1 — CLOSED 2026-09-21: FTS5 is available.** Verified on the device, logged in
`DECISIONS.md`, and the probe that answered it has been deleted. Search takes the FTS5
path and there is no `LIKE` fallback to fall into.

If a future device ever lacks FTS5, migration 002 will fail at the `migrate` stage and
the startup banner will say so. That is a new decision and a new ADR, not a silent
fallback (CODESTYLE §6).
