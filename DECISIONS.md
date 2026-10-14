# DECISIONS.md

Append-only. One dated line per decision or change of mind. Newest at the bottom.
Rationale lives in the ADR or spec section named on the line; this file is the index.

---

## 2026-09-21 — Opening the spec's open items (SPECS v0.1 → v0.2)

- ADR-001 Capacitor packaging: ACCEPTED as written. Android only, iOS not a target.
- ADR-002 SQLite via `@capacitor-community/sqlite`: ACCEPTED as written. FTS5 availability on device remains unverified and is tracked in §9.
- ADR-003 single device, no sync: ACCEPTED as written.
- ADR-004 PDF copy-on-import: ACCEPTED, amended. The original clause "deleting a reading entry deletes its copy" contradicted §4.1's soft delete; see the delete-semantics line below.
- ADR-005 frontend framework: ACCEPTED. Preact authored with JSX, aliased from React at build time, bundled with Vite. Rejected: React (heavier for no benefit this app can use), Svelte (new mental model, less reliable agent output), vanilla JS (nine modules plus search and tag views would mean hand-rolling a worse framework).
- ADR-005 language: TypeScript in strict mode. Chosen because type-specific fields live in an untyped JSON `payload`, so a wrong payload shape for a given `items.type` is the one bug class here that fails silently. Rejected: JS with checked JSDoc (verbose generics for the payload union), unchecked JS (wrong thing to trade away with no crash reporting and no second user to reproduce bugs).
- ADR-006 reuse policy: ACCEPTED as written.
- §4.2 schema: ACCEPTED with three amendments — `exercise` added to the `type` enum, `schema_version` constrained to a single row, and foreign-key enforcement made explicit (`PRAGMA foreign_keys = ON`, without which SQLite treats `REFERENCES` as documentation).
- §2.1 to-do due dates: NO. A due date invites sort-by-date, then a due-today view, then reminders, which is the calendar §1.1 item 6 forbids. §1.1 item 6 amended to say so explicitly.
- §2.2 quick capture prefix syntax: NONE in v1, as proposed. Chips only. A note legitimately opening with a prefix-shaped string would otherwise be misfiled with no signal.
- §4.3 workout exercises: CATALOG, not free text. Routines and logs reference `exercise` entities by id. Renaming propagates to every routine and past log; per-exercise history stops fragmenting by spelling. Cost accepted: a catalog to maintain and a picker mid-workout. Rejected: free text with a normalized lookup key (cheaper, but renaming never propagates).
- §4.4 habit streaks: STRICT consecutive local dates, as proposed. No rest days, no weekly-frequency habits in v1. Noted risk: strict streaks punish habits that are not genuinely daily.
- §5 PDF export: INCLUDED by default, flag to exclude. Reverses the spec's PROPOSED position, whose stated reason ("the originals already exist on the phone") contradicts ADR-004 — the app copies PDFs precisely so originals can be deleted, so the app's copy is often the only one and excluding it made the default backup incomplete.
- §5 export shape: a DIRECTORY (`majula-export.json` plus `pdfs/`). A single zip would need a new dependency and therefore an ADR; left OPEN in §9 rather than adding a dependency by implication.
- §4.1 delete semantics: soft delete RETAINS attached files; purge removes them. Resolves the ADR-004 / §4.1 contradiction in favour of §4.1, so that undelete actually works. Consequence: §4.1 referred to "an explicit purge action" that no module spec defined — purge is now a global action in §2.2 and lands in §7 step 1 alongside soft delete.
- §4.2 FTS and soft deletes: filter at QUERY TIME. A soft delete is an `UPDATE`, so the sync trigger re-indexes the row and deleted items would stay searchable; search now joins back to `items` on `rowid` and requires `deleted_at IS NULL`. Rejected: conditional delete-from-FTS inside the update trigger, which would need an undelete path exercised too rarely to stay correct.
- §1.1 item 12 finance: NO finance features at all. The clause "beyond expense capture with export" implied an expense module that existed nowhere in §2 or §4. §4.1's integer-cents money convention is kept, marked reserved, so a future money field cannot get it wrong.
- License: MIT. The repo is published to be readable and forkable; with no license, default copyright forbids both.

---

## 2026-09-21 — GATE E1 closed, Phase 1 built

- §5 export packaging: a DIRECTORY, not a zip. GATE E1 closed. `majula-export.json` beside a `pdfs/` directory in user-accessible storage; a data-only export is the same directory without `pdfs/`. Rejected: a single zip file, which would need a zip library and therefore an ADR, to buy a convenience the directory does not lack — any file manager already moves a folder. The container carries `pdfs/` from Phase 1 even though nothing attaches a PDF until Phase 5, so the format never has to change and a second import path never has to exist.
- Formatter: Prettier, with its config committed and a `.githooks/pre-commit` hook that refuses a commit the formatter would change (CODESTYLE §2). Not an ADR: §2 already requires a formatter, and this is which one. Rejected: husky, which is a dependency for something `core.hooksPath` does for free.
- Test SQL engine: `node:sqlite`, the platform's own, so migrations and the export round trip are testable without a device. Not a dependency: it ships with Node. Consequence: `erasableSyntaxOnly` is on in `tsconfig.json` so `node --test --experimental-strip-types` can run the TypeScript directly, which rules out constructor parameter properties and enums.
- Desktop browser behaviour: `npm run dev` renders the UI but cannot open the database, because SQLite is a native plugin (ADR-002). The failure is a visible banner rather than a browser storage fallback. A fallback would be a second storage path exercised only by the developer, and §6 puts acceptance on the device anyway.

---

## 2026-09-21 — Phase 1 verified on device, GATE V1 closed

- Phase 1 acceptance: PASSED on the owner's phone, in airplane mode. Capture, list, check off, soft delete, restore, purge, export, uninstall/reinstall, import — all seven checks, with the surviving data returning and the purged row staying gone.
- GATE V1 FTS5 availability: AVAILABLE. Verified on device by a probe that created and dropped a temporary FTS5 table and logged the result, rather than by assumption. Consequence: search takes the FTS5 path and the `LIKE` fallback is not built. ADR-002's open consequence is now settled; §9's checklist is empty. Should a future device lack FTS5, the fallback comes back as a new decision, never as a silent runtime path (CODESTYLE §6). The probe was deleted once it had answered — it had nothing left to say.
- Tooling defect found while verifying: the documented `adb logcat` command was wrong twice over. Capacitor forwards WebView console output under the tag `Capacitor/Console`, not `chromium`, so the documented filter hid every line the app writes; and without `-d`, `logcat` tails forever and reads as a hang. `CLAUDE.md` now carries the working form, and the PowerShell equivalent, since PowerShell is the owner's shell and `grep` does not exist there.
- Tooling defect found while building: `npm run apk` failed under `cmd.exe`, which is what npm runs scripts through. Git Bash exports `NoDefaultCurrentDirectoryInExePath`, so neither `./gradlew` nor a bare `gradlew` resolves from the working directory. The script now invokes `.\gradlew.bat` by explicit relative path.

---

## 2026-09-21 — Phase 2 built

- Search input handling: every token typed is QUOTED into the FTS5 `MATCH` expression and given a trailing `*`. Quoting makes the token a literal, so a stray `"`, a leading `-` or the word `NEAR` is searched for rather than executed as FTS5 operator syntax; the `*` gives prefix matching, so results appear before a word is fully typed, which is what makes search usable one-handed. Rejected: passing raw input to `MATCH`, which turns a typo into a thrown error or, worse, a silently different search.
- Migration 002 ends with an FTS5 `rebuild`. Without it every row captured in Phase 1 would be absent from the index permanently — a failure that looks like nothing at all, since search would simply not find them.
- Import path reworked. It now drops the schema, rebuilds it at the export's own version, restores the rows there, and migrates them forward. Required because re-running a migration over a schema that already holds its objects fails on the second `CREATE`, and because pouring old rows into a newer schema would skip the transformations migrations exist to perform. Consequence: the export file is fully validated BEFORE anything is dropped. Reversing that order would turn a malformed export into total data loss, which is precisely what ADR-003 makes export exist to prevent.
- `items_fts` is not exported. It is derived from `items` and rebuilt by its triggers as the restore inserts rows; exporting it would write the same text into the backup twice and create a second thing that can disagree with itself.
- Tags in quick capture: an optional field, hidden behind a `#` control, rather than a permanent second input. §2.2 requires capture to be one tap from the home screen, and a field to skip past on every note is friction on the path that matters most. Rejected: parsing `#tag` out of the title, which is the prefix-syntax magic GATE P1 already closed against.
- Search placement: with the list it filters, not in the footer with capture. §6's one-handed requirement is about primary actions, and capture is the primary action; a third footer row would eat the list to make retrieval marginally easier than the tap that follows it.

---

## 2026-09-21 — Phase 3 built

- `habit_checks` uses `ON DELETE CASCADE` on `habit_id`. A soft delete is an `UPDATE`, so check-ins survive it and an undeleted habit keeps its streak; a purge is the app's one hard delete (§2.2) and takes them with it. Rejected: deleting check-ins in application code during purge, which would be a second place for the rule to live and a way for it to drift.
- The streak walk is a pure function taking `today` as an argument rather than reading a clock. §4.4 warns that the walk is trivial and the calendar is not, so midnight rollover, timezone change in both directions, month, year and leap-day boundaries are tests instead of reasoning. `previousLocalDate` does date arithmetic on the calendar parts rather than subtracting 86,400,000 ms, which lands on the wrong day across a DST boundary.
- Habits get their own row component rather than a branch inside the generic one. A habit carries a streak and a today-toggle where everything else carries a done flag, and §1.1 item 7 makes that streak the only statistic in the app — keeping it in one small component keeps it that way.
- `habit_checks` is exported; `items_fts` still is not. The distinction is facts against derived data: a check-in is something that happened and cannot be recomputed, an index can.

---

## 2026-09-22 — Migration 002 failed on the device

- Cause: `@capacitor-community/sqlite` does not pass a script to SQLite whole. `UtilsSQLite.getStatementsArray` splits on `";\n"`, runs the pieces separately, and reassembles a trigger only by appending a fragment that is exactly `END` to the single fragment before it. `items_fts_after_update` has two statements in its body, so it reached SQLite as an unterminated `CREATE TRIGGER ... BEGIN ...` plus an orphaned tail, and startup failed. `node:sqlite`'s `exec()` has no such behaviour, so all 73 tests passed against a database the device could never build.
- Fix: every trigger is written on one line, leaving no `";\n"` inside it for the splitter to cut at.
- **Exception taken to SPECS §6 / CODESTYLE §10, "a shipped migration is never edited."** Migration 002 was edited rather than superseded by a 004. The rule exists so devices that already applied a migration cannot diverge from devices that apply the corrected one. No device ever applied 002: it throws inside its own transaction, which rolls back, leaving `schema_version` at 1 everywhere. With nothing to diverge from, a corrective migration would have added a permanent scar to the schema history to fix something that had never existed outside the repository. Had a single device reached version 2, the answer would have been 004 instead.
- Prevention: `test/support/capacitor-splitter.ts` ports the plugin's splitter, and `test/migration-statements.test.ts` runs every migration through it — asserting no trigger is left unterminated, no orphaned `END` appears, and the resulting schema actually reindexes on update. The generic lesson is that the test driver is `node:sqlite` and the device is not, so anything relying on how SQL is *delivered* rather than what it says needs a test that models the delivery.
- Second defect, found while diagnosing: the startup banner reported every failure as "could not open its database ... it runs on the phone, not in a desktop browser". A migration failure is neither of those things, and the message actively misdirects. Startup now fails with a stage — `open`, `migrate` or `files` — and the screen says which, with advice that matches. A diagnostic that confidently names the wrong cause is worse than one that says nothing (CODESTYLE §6).

---

## 2026-09-23 — Phase 2 verified on device

- Phase 2 acceptance: PASSED on the owner's phone, all eight checks, on the build carrying the corrected migration 002. Body-only search, prefix search, multi-word AND, soft-delete exclusion and restore, the four type views, tag capture and tag view, and search surviving an export/import round trip.
- Check 5 is the one that matters most: an item captured in Phase 1, before `items_fts` existed, was found by a word in its body. That is the migration's `rebuild` doing its job on real data, and it is the failure that would otherwise have been invisible — search would simply never have found anything older than the index.

---

## 2026-09-23 — Phase 4 decisions

- §4.3 recipe ingredients: `qty` and `unit` OPTIONAL, `name` required. Owner's decision. A required numeric `qty` cannot represent "sal a gosto" or "a pinch of salt", and would force either a made-up number or moving the ingredient into a step, where the list stops being scannable at the counter. Rejected: keeping `qty` required; and allowing `0` displayed as blank, which makes `0` stop meaning zero — a silent misreading of exactly the kind CODESTYLE §6 exists to prevent. Payload shape only; no migration.
- Kitchen mode keep-awake: the platform's Screen Wake Lock API (`navigator.wakeLock`), not `@capacitor-community/keep-awake`. §6 names that plugin "or equivalent", but CODESTYLE §11 prefers a platform API over a package, and a package would need an ADR under §8. MDN's compatibility data marks Android WebView as mirroring Chrome Android, where the API is supported, and Capacitor serves the app from `https://localhost`, which satisfies its secure-context requirement. "Mirror" is inherited data rather than a tested result, so it is verified on the device like GATE V1 was: acquisition logs `kitchen.wake_lock` with its outcome, and a refusal is visible rather than silent. Only if the device refuses does the plugin come back, with an ADR.

---

## 2026-09-23 — Back button

- §2.2 Back: the Android back button undoes one step and never commits — it cancels an edit in progress, closes an open item, or leaves Deleted or Backup for the list; only on the list does it leave the app. Owner's instruction, with adding a recipe as the named case.
- Consequence for the cookbook: capturing a recipe no longer writes a row before the editor opens. It used to, which meant even a perfect Cancel left a half-made recipe behind. Nothing is written until Save; Cancel or back discards the new recipe with nothing created and nothing under Deleted. `docs/modules/cookbook.md` criteria 1, 8 and 15 amended.
- Mechanism: our own `MainActivity` registers an `OnBackPressedCallback` that sends back to the WebView's history when it can go back, and otherwise lets Android leave the app; the web side pushes a History API entry for each step that back should undo. Capacitor's Android core has no back handling at all — that lives in `@capacitor/app` — so without this, back exits the app and JavaScript never sees it. Rejected: `@capacitor/app`, a new dependency and an ADR under §8 for exactly one function, which CODESTYLE §11 calls "a dependency not worth having". Both halves of the chosen mechanism are platform APIs, Android's and the browser's, with no package between them.

---

## 2026-09-23 — Phase 5 decisions

- PDF rendering: `pdfjs-dist`. Not a new ADR — ADR-004, ACCEPTED, already decides "Render with PDF.js". Loaded lazily with a dynamic `import()` when the viewer or an attach first needs it, because it is about a megabyte plus a worker and §6 promises cold start to typing in about two seconds. Its worker, standard fonts and character maps are bundled into the app rather than fetched, because a viewer that reaches for a CDN fails in airplane mode (§6).
- File picking: a plain `<input type="file" accept="application/pdf">`. Capacitor's WebView client implements `onShowFileChooser`, so the system picker opens without a plugin. Rejected: a file-picker plugin, a dependency for something the platform already does.
- One PDF per entry, no replace. Replacing would leave the old copy referenced by no row at all, and purge only removes files that belong to soft-deleted rows, so the old copy would sit in private storage forever and ride along in every export. Changing the PDF is delete-and-recreate, which routes the old file through the existing soft-delete and purge path.
- A missing PDF is a named path, not a crash. An import from an export made without PDFs leaves entries naming files that are not there; the viewer says so and logs `reading.pdf_missing` (CODESTYLE §6).

---

## 2026-09-23 — Phase 6 decisions

- Place coordinates: from the current location (a **Here** button) or pasted from a maps app. Owner's decision. Rejected: paste only, which never adds a permission but fails the design test, since nobody gets coordinates in seconds by copying them out of another app; and no coordinates yet.
- Consequence: the app gains `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION`. Requested the first time Here is tapped, never at install. It uses the WebView's own `navigator.geolocation` — Capacitor's WebView client already relays the permission prompt — so no location plugin and no ADR. The position is read only on that tap; there is no background location and no history. Coordinates are never logged: they identify where the owner has been, which is the same category as the note bodies CODESTYLE §6 keeps out of logs.
- Accuracy is shown at the moment of the fix and not stored. §4.3's place payload is `lat` and `lon`; widening it for a number that only matters at capture time would be the quiet schema growth §4.1 warns against.
- Pasted coordinates accept decimal points only. A pair written with decimal commas cannot be split reliably — `-12,34, -56,0` has three commas and nothing says which one separates the numbers — so it is refused, the same reasoning as the ambiguous recipe quantities. Maps apps copy with decimal points regardless of locale, which is the case that matters.
- A pair that only makes sense as longitude-then-latitude is refused, not swapped. Swapping would be right most of the time and silently wrong the rest, and a place filed in the wrong hemisphere is found by nobody.
- "Open in maps" hands a `geo:` link to the system. Capacitor's bridge sends any link outside the app's own host to Android as an `ACTION_VIEW` intent; checked that a host-less URI such as `geo:` cannot trip its host matching. This is handing a place to another app, not rendering one — the roadmap's "stored, not rendered" stands.

---

## 2026-09-23 — Phase 7 decisions

- Deleting an exercise still used by routines or logs: an ordinary soft delete; routines and past logs keep showing its name. Purge skips an exercise still referenced by any routine or log that survives the purge, and reports how many it kept. Owner's decision, on the recommendation. Rejected: refusing the delete outright, which would make the catalog impossible to tidy; and letting purge remove it, which would leave past workouts pointing at nothing.
- Deleting a routine that has logs: the logs keep working and show "from a deleted routine". Purge skips a routine still referenced by a surviving log. Owner's decision, on the recommendation.
- Purge computes survivors as a fixed point. A deleted routine held back by a surviving log is itself a survivor, so the exercises it uses are referenced too. A deleted routine and a deleted exercise used only by it are purged together in one run.
- CODESTYLE §10 amended: reads that see soft-deleted rows are now the Deleted view, the purge path, and reference resolution in `src/data/references.ts`. The third follows directly from the first decision — a past log cannot show a deleted exercise's name without reading the deleted row. It resolves by id and never lists, so a deleted exercise still cannot leak into the catalog or the picker.
- Integrity on write: a routine or log may reference only ids that are exercises (or, for a log's `routine_id`, a routine), deleted or not. On read, a reference to a row that no longer exists is logged as `workout.dangling_reference` and shown as "Unknown", per CODESTYLE §10.
- Load parsing reuses the cookbook's quantity rules, including refusing `1.000`-style ambiguity. The parser moves out of the recipe module into a shared one rather than being copied.
- No Exercise chip in quick capture. The roadmap puts inline creation in the picker, which is where an exercise is actually needed; a tenth capture chip would buy a second way to do the same thing at the cost of footer height. Exercises are renamed and annotated from the Exercises view.
- The workout screens live in their own controller component, not in `App.tsx`, which has grown past twice CODESTYLE §4's soft ceiling of about 200 lines. Splitting the earlier modules out of `App.tsx` follows as its own commit once Phase 7 works.

---

## 2026-09-23 — App.tsx split

- The module screens moved out of `App.tsx` into per-module controllers, as the Phase 7 entry committed to. It had grown to 481 lines against CODESTYLE §4's soft ceiling of about 200, one phase at a time. `App.tsx` is now the list alone, at 243 lines, and a new module adds a controller rather than growing it.
- Bug found by the move: the PDF viewer's on-screen Close re-read the entry but left the viewer open; only the hardware back button closed it. The Phase 5 device checklist tested back but not Close, so it would have shipped. Fixed in `ReadingScreens`.
- Bug found while checking the move in a browser: closing the viewer mid-render left PDF.js's cancelled render as an unhandled promise rejection, against CODESTYLE §8. The render loop now treats a cancellation as the close working.

---

## 2026-09-23 — Android permissions audited

- `USE_BIOMETRIC` and `USE_FINGERPRINT`: REMOVED with `tools:node="remove"` in the app manifest. `@capacitor-community/sqlite` merges them in for its biometric-locked databases. Majula opens its database with `encrypted: false` and never uses them, and SPECS §1.1 item 4 rules out credentials of any kind. A permission nothing uses is still one the OS grants.
- `INTERNET`: REMOVED. ADR-003 says no feature needs a network, and SPECS §6 makes offline the only mode. Without the permission, Android enforces both instead of leaving them to convention. SPECS §6 amended to say so. This is safe because Capacitor serves the app from `https://localhost` by answering every request inside the WebView (`shouldInterceptRequest`), so no socket is opened. The WebView's `blockNetworkLoads` defaults to on without the permission, but it does not apply to intercepted requests. External links (reading URLs, `geo:`) leave as intents, so they need nothing either. `npm run dev` runs in a desktop browser and is unaffected.
- Verified on the owner's phone rather than by that argument, on a build without the permission, through the debug WebView's devtools protocol. The app started and opened its database. The lazy PDF chunk loaded. The PDF.js worker started and fetched its standard font and character map from the bundled assets, and a generated one-page PDF rendered text to a canvas. `fetch('https://example.com/')` failed, which confirms the OS block is real. `navigator.geolocation` was present with permission state `prompt`. The Here prompt itself and a PDF opened through the UI are left to the owner's device checks in `CLAUDE.md`.
- `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION` KEPT (Phase 6, places). `dev.majula.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` KEPT. It is an AndroidX signature permission that guards the app's own receivers and grants nothing outside the app.
- Consequence: any future feature that truly needs the network has to add `INTERNET` back to the manifest, which makes it a visible manifest change that needs a new ADR (ADR-003).

---

## 2026-10-13 — Device checks: Phases 3, 4, 6, 7 and the back button

- PASSED on the owner's phone: Phase 3 (habits), Phase 4 (cookbook, including the screen held awake by the platform Screen Wake Lock API, so `@capacitor-community/keep-awake` is not needed), Phase 6 (places), Phase 7 (workouts), and the back button.
- Phase 5 (reading queue): one issue reported. An A4 page does not fill the phone's screen, which makes it hard to read; the owner asked for it bigger if possible, otherwise centred. Handled below.
- Places: the owner asked for a way to take a place from a Google Maps listing, such as a restaurant seen there. Not a defect against the module spec; a new capability, raised with the owner as a decision.
- The permission checks from the audit were not reported on, so they stay open.

---

## 2026-10-13 — Owner's requests after the device checks

- PDF viewer: pages now run edge to edge and are centred vertically (commit ad40ca0). Upright, an A4 page cannot fill a phone screen without stretching, being proportionally wider.
- PDF reading size: BOTH trim margins and zoom. Owner's decision. Trim crops each page's white margins, found by inspecting the rendered page, so text fills the width with no sideways scrolling; zoom steps 100/150/200/250%, scrolling both ways above 100%. Both remembered per document in the reading payload (`zoom`, `trim_margins`), beside `last_page` — SPECS §4.3 amended, no migration, since the payload is JSON. Fixed steps rather than pinch-zoom: four buttons are one-handed and predictable, and pinch on a canvas would mean re-rendering on every gesture. 250% is the ceiling because the canvas grows with the square of the zoom at the device's pixel density.
- Places from Google Maps: BOTH sharing a listing to Majula and pasting its link. Owner's decision. The link goes in the generic `url` column and **Open in maps** opens it, so the exact listing comes back. Short links carry no coordinates and resolving them needs the network, which the app no longer has (ADR-003, and the permissions audit); coordinates are taken from a link only when it contains them. Rejected: resolving short links, which would need `INTERNET` back and an ADR.
- Receiving shares: an intent filter for `ACTION_SEND` text on the existing activity, and a small Capacitor plugin written inside the app (`ShareInboxPlugin`) that hands the shared text to the web layer, using `notifyListeners` with `retainUntilConsumed` so a share that cold-starts the app waits for the page to start listening. No package, so no ADR, by the same reasoning as the back button. Only text with a Google Maps link becomes a place; any other share is refused and writes nothing, so Majula never files shared text under a type it guessed.

- PDF viewer swipe: left turns to the next page, right to the previous. Owner’s request. When zoomed, a sideways swipe already pans the page, so a swipe turns the page only if it began with the page at that edge; otherwise it is left to scroll. Rejected: always turning on a swipe, which would make a zoomed page impossible to read across. Touch listeners are passive and never cancel the browser’s own scrolling; the gesture is judged after the finger lifts, by a pure function under test.

## 2026-10-14 — Device check: swiping between PDF pages

- Swiping turns pages on the owner's phone (CLAUDE.md, *PDF size and swiping*, check 7). The zoomed-edge behaviour (check 8) and the other PDF size, Places from Google Maps, Phase 5 re-check and permission checks were not reported on, so they stay open.

## 2026-10-14 — Device checks: all open checks passed

- PASSED on the owner's phone: the Phase 5 re-check (reading queue), PDF size and swiping including the zoomed-edge rule, places from Google Maps, and the permissions audit (no `INTERNET`, only location). Phase 5 is closed; every phase in `ROADMAP.md` is now closed.

---

## 2026-10-14 — Search covers every category

- Search ignores the category or tag selected on the list and always covers every type. Owner's decision. `searchAll` no longer takes a filter, and the data layer's unused `type` search option went with it. SPECS §2.2 amended.

---

## 2026-10-14 — Redesign: the list and quick capture

- The list shows one category at a time, picked from a row of eight line icons below the habits; it opens on To-do. The mixed list of every type is gone. Owner's decision, from the redesign: a mixed list read as clutter. Routines, workout logs and exercises share one Workouts category, so the data layer's list query takes several types (`types`, bound one placeholder per type).
- Quick capture follows the category the list shows instead of defaulting to a note, and its type button offers every capturable type; picking one switches the list too, so what was just captured is in view. Owner's decision, from the redesign. `docs/modules/notes.md` criteria 2 and 4 amended to match.
- Habits sit above the category icons on every category, as cards that log today with one tap, and are not one of the eight icons. Their heading opens the habit list, which is where a habit is deleted.
- Rows lose the per-row × button: delete is a swipe to the left, judged by a pure function under test (`row-swipe.ts`). Inside one category a row carries no type label; where types mix it carries the type's icon. Checked rows fold under a "Done" line.
- Deleted and Backup move off the list's footer into one screen behind the header's menu button. Purge moves from Backup to the Deleted tab, beside what it removes.
- Typeface: the system font, not the design's Barlow. Owner's decision: Barlow is not required, and a font already on the phone costs no bundled files (the app has no network, §6) and no ADR.

---

## 2026-10-14 — Redesign: module screens and the recipe rating

- Recipes get an optional rating, an integer from 0 to 10 counting half stars, shown as five stars. Owner's request. It lives in the recipe payload beside servings, so there is no migration, the same reasoning as the reading view's `zoom` and `trim_margins`; SPECS §4.3 and `cookbook.md` amended. Absent means not rated and shows no stars, never five empty ones. In the editor each star is a whole button and tapping the last full star again halves it, so a half star never needs a target half a thumb wide.
