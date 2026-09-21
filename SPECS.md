# SPECS.md — Personal all-in-one capture app

Status: v0.2, 2026-09-21. Owner has final say on every item. Anything marked **OPEN** is
undecided; anything marked **PROPOSED** is a recommendation awaiting confirmation. The
agent must not resolve OPEN items on its own. Decision history is in `DECISIONS.md`.

---

## 1. Product brief

**What it is.** A phone app for one person. The phone is a capture surface and a glance view: ideas on the bus, a recipe while cooking, a tap to log a habit. Review, organization and deep work happen elsewhere (the computer, a notebook, paper).

The name of the app will be Majula, with gold/yellow + black accent theming. The app icon will be designed later to resemble a DS2 Bonfire with said colors (black background, gold bonfire).

**Design test for every feature.** Can it be done in seconds, one-handed, with no signal? If not, it does not belong on the phone.

### 1.1 Non-goals

These are binding. The agent must not build anything on this list, even if it seems helpful.

1. Built for one user. Published on GitHub, not supported. The README says so. No issue triage, no feature requests.
2. No settings or options for preferences the owner does not personally have.
3. No abstractions for hypothetical users or use cases.
4. No accounts, auth, login, or credentials of any kind.
5. No sync, no server, no cloud backend. Single device (see ADR-003).
6. No calendar. This includes due dates on to-dos (see §2.1).
7. No analytics dashboards, charts, or statistics screens (beyond a streak count).
8. No PDF annotation, highlighting, or margin notes.
9. No pantry quantity tracking or depletion logic.
10. No review/follow-up workflows for the network log.
11. No question bank or study tools.
12. No finance features. No expense capture, no budgeting, no spending views. Money is a separate concern and this app is neither upstream nor downstream of one.
13. No integration with, or migration from, the owner's other projects.

---

## 2. Modules

| Module | Entity | Structure | Status |
|---|---|---|---|
| Notes | `note` | generic | confirmed |
| To-do | `todo` | generic + done | confirmed |
| Reading queue | `reading` | generic + optional PDF | confirmed |
| Network log | `contact` | generic | confirmed |
| Habit streak | `habit` + check-ins | generic + event table | confirmed |
| Running-low list | `grocery` | generic + done | confirmed |
| Cookbook | `recipe` | typed payload | confirmed |
| Workout routine | `routine`, `workout_log`, `exercise` | typed payload + catalog | confirmed |
| Places to try | `place` | generic + optional coords | confirmed |

### 2.1 Module behavior summaries

Full acceptance criteria live in per-module specs (`docs/modules/<name>.md`), written just before each module is built. Summaries only:

- **Notes.** Free text, optional tags. Created from quick capture.
- **To-do.** Text, done flag. No due date: ACCEPTED 2026-09-21. A due date field leads to a sort-by-date view, then a due-today view, then reminders, which is the calendar §1.1 item 6 forbids.
- **Reading queue.** Title, optional URL, optional attached PDF. Read status. PDF viewer opens attached file and restores last page. No annotation.
- **Network log.** Capture only: name, where met, short context. No follow-up reminders.
- **Habit streak.** Habit definitions; one tap logs today. Displays current streak. Tapping again on the same day undoes.
- **Running-low list.** Tap to add an item when noticed; check off when bought. This is the grocery list. No quantities.
- **Cookbook.** Recipes with ingredients (quantity, unit, name), ordered steps, servings. Must be readable in the kitchen: large text, screen stays awake while a recipe is open.
- **Workout routine.** Routine templates (exercises with sets, reps, load) and session logs. Exercises come from a catalog of `exercise` entities referenced by id, not free text: ACCEPTED 2026-09-21. Built last.
- **Places to try.** Name, optional note, optional coordinates.

### 2.2 Cross-cutting features

- **Quick capture.** One input reachable from the home screen in one tap. Defaults to `note`. Type selected via chips, not parsed from text. No prefix syntax (`t: buy milk`) in v1: ACCEPTED 2026-09-21. Parsing magic is a source of silent misfiling, and a note that legitimately opens with a prefix-shaped string would be filed as the wrong type without any signal.
- **Global search** across title and body of all entities. Excludes soft-deleted rows (§4.2).
- **Tag views.** Saved filters over the generic entity table. Most modules are views, not separate screens with separate storage.
- **Purge.** A global action that hard-deletes soft-deleted rows and removes their attached files. Not per-module. Lands in the vertical slice, since soft delete does (§7 step 1).
- **Export/backup.** Required, not optional. See §5.

---

## 3. Architecture decisions

Format: context, decision, consequences. Each ADR is final once marked ACCEPTED; changes go through a new ADR and a decision-log entry.

### ADR-001 — Packaging: Capacitor

**Status:** ACCEPTED 2026-09-21

**Context.** A PWA cannot hold durable references to files in phone storage (no File System Access API on iOS Safari; limited on Android), and browser storage quota is subject to eviction. The reading queue needs a PDF viewer over files already on the phone. The owner has prior Capacitor and Kotlin experience.

**Decision.** Capacitor wrapping a web frontend. Android is the primary target.

**Consequences.** Real filesystem access and persistent storage. Adds a native build toolchain and APK install flow. iOS is not a target unless explicitly added.

### ADR-002 — Storage: SQLite

**Status:** ACCEPTED 2026-09-21

**Context.** Options are IndexedDB inside the WebView or native SQLite via a Capacitor plugin. Data is relational in places (habit check-ins, workout logs) and needs full-text search.

**Decision.** SQLite via `@capacitor-community/sqlite`. Full-text search via FTS5.

**Consequences.** Real SQL, migrations, FTS. Not eviction-prone. Must verify FTS5 is available in the plugin's bundled SQLite build on the target Android version before relying on it; fallback is `LIKE` queries, acceptable at personal-data scale. This verification is still **OPEN** (§9) and blocks §7 step 2.

### ADR-003 — Single device, no sync

**Status:** ACCEPTED 2026-09-21

**Context.** Sync requires a server or a third-party service, conflict resolution, and auth. None serves the capture-on-the-go purpose.

**Decision.** All data lives on one phone. No network access required for any feature.

**Consequences.** Losing or wiping the phone loses all data unless exported. This makes export/backup (§5) a hard requirement. Desktop review of phone data happens via export, not sync.

### ADR-004 — PDF handling: copy on import

**Status:** ACCEPTED 2026-09-21

**Context.** Even under Capacitor, relying on external file paths is fragile: the user can move, rename or delete files, and Android scoped storage complicates persistent access.

**Decision.** When a PDF is attached, copy it into the app's private data directory via `@capacitor/filesystem`. The entity stores the internal path. Render with PDF.js.

**Consequences.** Duplicates storage for attached PDFs. Links never break. Two-column academic PDFs will read poorly on a phone regardless; this is accepted, since the use case is short articles. Because the app's copy may become the only copy, attached PDFs are included in export by default (§5). Deleting a reading entry is a soft delete and **retains** the file; purge removes it (§4.1).

### ADR-005 — Frontend framework

**Status:** ACCEPTED 2026-09-21

**Context.** Owner's prior projects are JavaScript. Nine modules, most of them views over one table, plus global search and tag filters. Cold start to typing under ~2 s is dominated by WebView boot, Capacitor bridge init and opening SQLite, not by framework bundle size, so weight is a weak criterion. Maintainability across nine modules and the reliability of agent-generated code are the strong ones.

**Decision.** Preact, authored with JSX and aliased from React at build time, bundled with Vite. TypeScript in strict mode.

**Consequences.** React's component model and the largest available pool of correct patterns, at roughly a tenth of React's runtime weight. A small class of React-ecosystem packages that reach into React internals will not work; this app needs none of them. TypeScript makes `items.type` a discriminated union with a payload shape per variant, which is the one boundary in this schema where a wrong shape would otherwise fail silently (§4.1). Adds a build step, which every candidate framework required anyway.

### ADR-006 — Reuse policy toward existing repos

**Status:** ACCEPTED 2026-09-21

**Decision.** The owner's other projects may be read for UI patterns worth keeping (list/detail layouts). No code, schema, or data is imported from any of them.

---

## 4. Data model

### 4.1 Conventions

- IDs: UUID v4 strings.
- Timestamps: ISO 8601 UTC strings (`2026-09-21T14:03:00Z`). Dates without time (habit check-ins): `YYYY-MM-DD` in local time. These are two distinct types with two distinct helpers and are never passed to each other's functions.
- Soft delete via `deleted_at`. Hard delete only via the explicit purge action (§2.2).
- Attached files follow the row: a soft delete **retains** the file, purge removes it. A soft-deleted row whose file was already gone would be recoverable in name only.
- Money: integer cents, never floats. **Reserved** — no module currently stores money (§1.1 item 12). The convention stands so that a future one cannot get it wrong.
- Foreign keys are enforced. `PRAGMA foreign_keys = ON` on every connection; without it SQLite treats `REFERENCES` as documentation.
- References that live inside `payload` JSON (`exercise_id`, `routine_id`) cannot be enforced by SQLite. Their integrity is the data layer's responsibility, checked on write and on read.
- `payload` holds type-specific fields as JSON. If a module needs a field that neither the generic columns nor a small payload can hold cleanly, stop and revisit the module before widening the schema.

### 4.2 Schema

**Status:** ACCEPTED 2026-09-21

```sql
CREATE TABLE items (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,          -- note | todo | reading | contact | habit
                                      -- | grocery | recipe | routine | workout_log
                                      -- | exercise | place
  title       TEXT NOT NULL,
  body        TEXT,
  url         TEXT,
  done        INTEGER NOT NULL DEFAULT 0,
  payload     TEXT,                   -- JSON, type-specific
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

CREATE TABLE tags (
  item_id  TEXT NOT NULL REFERENCES items(id),
  tag      TEXT NOT NULL,
  PRIMARY KEY (item_id, tag)
);

-- Habits need an event log; a streak cannot be derived from a single row.
CREATE TABLE habit_checks (
  habit_id  TEXT NOT NULL REFERENCES items(id),
  date      TEXT NOT NULL,            -- YYYY-MM-DD, local
  PRIMARY KEY (habit_id, date)
);

CREATE INDEX idx_items_type ON items(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_tags_tag ON tags(tag);

CREATE VIRTUAL TABLE items_fts USING fts5(
  title, body, content='items', content_rowid='rowid'
);
-- Keep items_fts in sync via triggers on insert/update/delete.

CREATE TABLE schema_version (
  id       INTEGER PRIMARY KEY CHECK (id = 1),
  version  INTEGER NOT NULL
);
```

**Soft delete and search.** A soft delete is an `UPDATE`, so the update trigger re-indexes
the row and it stays in `items_fts`. Deleted rows are excluded at query time instead: search
joins back to `items` on `rowid` and requires `deleted_at IS NULL`. ACCEPTED 2026-09-21.
The index stays a plain index of everything, no conditional trigger logic exists, undelete
needs no special handling, and the same filter applies unchanged to the `LIKE` fallback.

### 4.3 Payload shapes and example rows

Generic types (`note`, `todo`, `contact`, `grocery`, `exercise`) use no payload or an empty one.

```jsonc
// note
{ "type": "note", "title": "Idea: RRT reuse across episodes", "body": "cache the tree..." }

// todo
{ "type": "todo", "title": "Renew bus card", "done": 0 }

// contact
{ "type": "contact", "title": "Ana Souza", "body": "Met at SBAI poster session, works on UAV GNSS" }

// grocery
{ "type": "grocery", "title": "Olive oil", "done": 0 }

// reading
{ "type": "reading", "title": "Tightly coupled GNSS/INS review", "url": "https://...",
  "payload": { "pdf_path": "pdfs/<uuid>.pdf", "page_count": 14, "last_page": 6 } }

// habit (check-ins live in habit_checks)
{ "type": "habit", "title": "Stretch" }

// recipe
{ "type": "recipe", "title": "Feijão tropeiro",
  "payload": {
    "servings": 4,
    "ingredients": [ { "qty": 500, "unit": "g", "name": "feijão" } ],
    "steps": [ "Cozinhe o feijão...", "..." ]
  } }

// exercise (catalog entry; body optional, for form cues)
{ "type": "exercise", "title": "Bench press" }

// routine (template)
{ "type": "routine", "title": "Upper A",
  "payload": { "exercises": [ { "exercise_id": "<uuid>", "sets": 4, "reps": 8, "load_kg": 60 } ] } }

// workout_log (one performed session)
{ "type": "workout_log", "title": "Upper A — 2026-09-21",
  "payload": { "routine_id": "<uuid>",
    "performed": [ { "exercise_id": "<uuid>", "sets": [ { "reps": 8, "load_kg": 60 } ] } ] } }

// place
{ "type": "place", "title": "Café on Rua X", "payload": { "lat": -12.34, "lon": -56.0 } }
```

**Exercise catalog.** ACCEPTED 2026-09-21: routines and logs reference `exercise` entities by
id rather than storing free-text names. Renaming an exercise propagates to every routine and
every past log, and per-exercise history is reliable rather than fragmented by spelling. The
cost is a catalog to maintain and a picker in the workout flow. What happens when an exercise
still referenced by a routine is deleted is decided in the workout module spec, not here (§7).

### 4.4 Streak definition

**Status:** ACCEPTED 2026-09-21

Current streak = number of consecutive local dates ending today (or yesterday, if today is not yet checked) present in `habit_checks` for that habit. Missing a day resets to zero. No "rest days" and no weekly-frequency habits in v1: the streak is a walk over consecutive dates, not a count of periods meeting a quota.

The hard part is not the walk, it is the calendar: the streak must stay correct across a midnight rollover and across a device timezone change. Test both explicitly.

---

## 5. Export and backup

Required because of ADR-003.

- Full export of all tables to a single JSON file, `majula-export.json`.
- **Attached PDFs are included by default**, with a flag to exclude them: ACCEPTED 2026-09-21. ADR-004 copies PDFs into private storage precisely so the originals can be deleted, which means the app's copy is often the only copy; an export that excluded it would be an incomplete backup by default.
- Export is therefore a **directory**, not a lone file: `majula-export.json` plus a `pdfs/` directory, written to user-accessible storage. A data-only export is the same directory without `pdfs/`. Packaging it as a single zip would require a new dependency and therefore a new ADR — **OPEN** (§9).
- Full import from that directory restores the database (replace, not merge), and restores the PDF copies when they are present.
- Export includes `schema_version`; import refuses newer versions and migrates older ones.
- Re-verify the export/import round trip after every schema change. It is the only thing standing between the owner and total data loss.

---

## 6. Non-functional requirements

- **Offline:** every feature works with no network. Non-negotiable. Verify in airplane mode, not by assertion.
- **Capture latency:** app cold start to typing in quick capture in under ~2 seconds on the owner's phone. Verify on device.
- **Kitchen mode:** open recipe keeps screen awake (`@capacitor-community/keep-awake` or equivalent) and uses large type.
- **One-handed:** primary actions reachable in the lower half of the screen.
- **Testing:** acceptance criteria verified on a real Android device, not only a desktop browser.
- **Migrations:** every schema change ships with a numbered migration and bumps `schema_version`. Shipped migrations are never edited; a mistake is fixed by the next migration.

---

## 7. Build order

1. Vertical slice: Capacitor shell, SQLite, `items` + `tags`, quick capture, one list view, soft delete + purge, export/import. Running on the phone.
2. Tag views and global search (covers notes, to-do, network log, running-low).
3. Habit streak.
4. Cookbook.
5. Reading queue with PDF viewer.
6. Places.
7. Workout routine, including the exercise catalog.

Do not write a module spec more than one step ahead.

---

## 8. Companion documents

- `README.md` — what the finished app is, for anyone who finds the repo.
- `ROADMAP.md` — the build path, phase by phase, and what gates each one.
- `CODESTYLE.md` — how the code is written and kept debuggable.
- `CLAUDE.md` — agent operating manual: build/run/deploy commands, directory layout, standing rules (no new dependency without an ADR; no new entity type without editing §4; no features from §1.1; offline-first).
- `DECISIONS.md` — append-only log, one dated line per change of mind.
- `LICENSE` — MIT.
- `docs/modules/<name>.md` — per-module acceptance criteria, observable behavior only.
- `docs/adr/NNN-title.md` — ADRs, if they outgrow §3.

**Process rule:** to change behavior, edit the spec first, then have the agent reconcile the code. Never patch code and leave the spec stale.

---

## 9. Open items checklist

- [x] ADR-005: frontend framework — Preact + JSX + TypeScript strict, 2026-09-21
- [x] Accept or amend ADR-001 through ADR-004, ADR-006 — all ACCEPTED 2026-09-21
- [x] To-do due dates: yes or no — no, 2026-09-21
- [x] Workout: free-text exercises vs catalog — catalog, 2026-09-21
- [x] PDF export: include or exclude by default — include, 2026-09-21
- [x] §4.2 schema — ACCEPTED 2026-09-21
- [x] Quick capture prefix syntax — none, 2026-09-21
- [x] Habit rest days / weekly frequency — neither in v1, 2026-09-21
- [x] Soft delete vs PDF file deletion — soft delete retains, purge removes, 2026-09-21
- [x] FTS and soft-deleted rows — filter at query time, 2026-09-21
- [x] Finance contradiction — no finance features at all, 2026-09-21
- [x] License — MIT, 2026-09-21

Still open:

- [ ] Verify FTS5 availability in the SQLite plugin on the target Android version. A device verification, not a preference. Blocks §7 step 2.
- [ ] Export packaging: directory (no new dependency) or single zip file (new dependency, needs an ADR). Blocks §7 step 1.
