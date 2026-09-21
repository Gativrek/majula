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

**Reading device logs:** `adb logcat | grep -i chromium` surfaces the WebView console,
which is where the logger writes. Event names are stable and greppable
(`migration.start`, `export.done`, `purge.done`).

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
- **`items_fts` does not exist yet.** It is blocked on GATE V1 and ships in Phase 2.
- **Export column names come from `src/data/tables.ts`**, never from the file being
  imported: no interpolation of data into SQL, including identifiers (CODESTYLE §10).

---

## Commits

- One logical change per commit, English, imperative, subject under ~72 characters.
- No commit leaves the build broken or the formatter unhappy. The pre-commit hook in
  `.githooks/` runs Prettier; enable it once per clone with
  `git config core.hooksPath .githooks`.
- Reformatting commits contain nothing but reformatting (CODESTYLE §2).

---

## Device verification — Phase 1 and GATE V1

Everything below needs the phone. Nothing here can be closed from a desktop, and
`ROADMAP.md` Phase 1 is not done until it is. Log the outcome in `DECISIONS.md`.

```bash
npm run apk && npm run install:apk
```

**Phase 1 acceptance** (`ROADMAP.md` Phase 1, *done when*), in airplane mode throughout:

1. Cold start to typing in quick capture, under ~2 s. Force-stop the app first, time it.
2. Capture a note, a to-do and a running-low item. All three appear in the list.
3. Check the to-do off; it stays checked after a restart.
4. Delete one item. It leaves the list and appears under **Deleted**. Restore it.
5. Delete it again, then **Purge deleted**. It is gone from both views.
6. **Export**. Confirm `Documents/Majula/majula-export.json` and `Documents/Majula/pdfs/`
   exist from a file manager.
7. Uninstall the app, reinstall the APK, **Import**. The surviving data comes back and the
   purged row does not.

**GATE V1 — FTS5 availability** (`SPECS.md` §9, ADR-002). It blocks Phase 2, not Phase 1,
so it is run once a build is on the phone. Over `adb logcat`, or from a temporary probe in
`initialiseApp`, run:

```sql
CREATE VIRTUAL TABLE fts_probe USING fts5(title, body);
```

It either succeeds or raises `no such module: fts5`. That outcome — not a preference —
decides FTS5 against the `LIKE` fallback for Phase 2. Record which, and the Android and
plugin versions it was observed on, in `DECISIONS.md`. Drop the probe table afterwards.
