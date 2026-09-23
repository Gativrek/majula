# ROADMAP.md — Majula

Work path derived from `SPECS.md` §7 (build order) and §9 (open items).
Reconciled against SPECS v0.2, 2026-09-21.

**Precedence.** `SPECS.md` is the source of truth. This file is a schedule, not a
decision record. It never resolves an item the spec left `OPEN` or `PROPOSED`.
Decisions are recorded in `DECISIONS.md`; rationale goes in the ADR or spec section.

**Reading the markers.**

- **GATE** — a decision or verification that blocks the phase it sits in. The agent
  does not resolve it. Work in that phase does not start until the gate is closed
  and the closure is logged in `DECISIONS.md`.
- *Done when* — the observable check that ends the phase. Not "code written".

**Every gate is closed.** Phase 1 is verified on device; Phase 2 is in progress.

---

## Phase 0 — Decisions — CLOSED 2026-09-21

All thirteen decision gates are settled and recorded in `DECISIONS.md`. Summary of what
the rest of this roadmap now assumes:

- **Stack:** Capacitor, Android only. Preact with JSX (aliased from React at build),
  Vite, TypeScript strict. SQLite via `@capacitor-community/sqlite`.
- **Storage:** single device, no sync. Soft delete retains attached files; a global
  purge action removes them.
- **Search:** FTS5 if the device has it, `LIKE` otherwise. Either way, soft-deleted rows
  are filtered at query time by joining back to `items`.
- **Scope changes:** no to-do due dates. No prefix parsing in quick capture. Strict
  consecutive-day habit streaks. Exercises come from an `exercise` catalog, referenced
  by id. No finance features of any kind.
- **Export:** PDFs included by default.
- **License:** MIT.

Remaining Phase 0 work, unblocked:

- Write `CLAUDE.md`: build/run/deploy commands, directory layout, standing rules.
- Create `docs/adr/` and `docs/modules/`, both empty until they are needed.

*Done when:* `CLAUDE.md` exists and a clean checkout builds and installs an APK.

---

## Phase 1 — Vertical slice (§7 step 1) — CLOSED 2026-09-21

Goal: one item captured on the phone, listed, soft-deleted, purged, exported, wiped,
re-imported.

**GATE E1 — CLOSED 2026-09-21: a directory.** `majula-export.json` beside a `pdfs/`
directory, in user-accessible storage. No zip library, so no new dependency and no new
ADR. Logged in `DECISIONS.md`.

- Toolchain
  - Capacitor project, Android as the only target.
  - Vite + Preact + TypeScript strict. `react` and `react-dom` aliased to
    `preact/compat` in the Vite config, so JSX is authored React-style.
  - Reproducible debug APK build, installed on the owner's own phone.
  - Commit hash surfaced somewhere in-app. Every later bug report depends on it.
- Database bootstrap
  - Migration `001` creates `items`, `tags`, `schema_version` (single-row, `CHECK (id = 1)`),
    `idx_items_type`, `idx_tags_tag`.
  - `PRAGMA foreign_keys = ON` on every connection. Without it the `REFERENCES` clauses
    in §4.2 are decorative.
  - Migration runner: numbered, forward-only, bumps `schema_version`, logs `from -> to`.
  - `items_fts` and its triggers are deferred to Phase 2 (they depended on GATE V1).
- Data layer
  - Create / read / update / soft-delete over `items`; tag write path.
  - Every read filters `deleted_at IS NULL` unless it is the purge path.
  - `items.type` as a TypeScript discriminated union, one payload type per variant,
    validated at the `JSON.parse` boundary. Static types do not survive parsing.
- Soft delete and purge (§2.2, §4.1)
  - Soft delete sets `deleted_at` and retains any attached file.
  - Purge is a global action, not per-module: hard-deletes soft-deleted rows and removes
    their files. It exists from this phase because soft delete does; without it, deleted
    rows accumulate forever and ship inside every export.
- Quick capture (§2.2)
  - Reachable from the home screen in one tap.
  - Defaults to `note`; type chosen via chips. No text parsing, no prefix syntax.
- One list view. Generic over `items`, not a per-module screen.
- Export / import (§5) — built in this phase, not bolted on later
  - Full export of all tables to `majula-export.json`, in the directory container E1 chose.
  - Export embeds `schema_version`.
  - PDF inclusion is not exercised yet (no PDFs until Phase 5), but the container must
    already be able to carry a `pdfs/` directory without a format change.
  - Import replaces the database, never merges. Refuses newer `schema_version`,
    migrates older ones.
- Non-functional verification on device (§6)
  - Cold start to typing in quick capture under ~2 s, measured on the owner's phone.
  - Every step above works in airplane mode.

*Done:* verified on the phone in airplane mode. Capture → list → soft delete → restore →
purge → export → uninstall/reinstall → import returned exactly the surviving data, and the
purged row stayed gone.

---

## Phase 2 — Tag views and global search (§7 step 2) — CLOSED 2026-09-23

Covers notes, to-do, network log, running-low as views over `items`.

**GATE V1 — CLOSED 2026-09-21: FTS5 is available.** Verified on the device with a probe
that asked SQLite directly. Search takes the FTS5 path; the `LIKE` fallback is not built.

- Module specs due now (`docs/modules/`): `notes.md`, `todo.md`, `network-log.md`,
  `running-low.md`. Acceptance criteria only, observable behaviour only.
- Search
  - `items_fts` + insert/update/delete triggers, shipped in the same migration.
  - Soft-deleted rows are excluded at query time: join back to `items` on `rowid`,
    require `deleted_at IS NULL`.
  - Search covers `title` and `body` across all types.
- Tag views
  - Saved filters over `items`. No new tables, no per-module storage.
- Behaviour per §2.1: Notes free text + optional tags. To-do text + done flag, **no due
  date field anywhere in the schema or the UI** (§1.1 item 6). Network log capture-only
  (§1.1 item 10). Running-low tap to add, check off when bought, no quantities (§1.1 item 9).
- Re-verify export/import after the FTS migration.

*Done when:* an item captured in Phase 1 is findable by a word in its body, a soft-deleted
item is not, and each of the four modules is reachable as a tag/type view.

Verified on the phone in airplane mode, all eight checks — including a Phase 1 item found
by a word in its body, which is the index rebuild working, and search surviving an
export/import round trip. It took a second build: the first migration 002 failed on the
device (see `DECISIONS.md`, 2026-09-22).

---

## Phase 3 — Habit streak (§7 step 3) — AWAITING DEVICE CHECK

- `docs/modules/habits.md` first.
- Migration adds `habit_checks` (`habit_id`, `date` as `YYYY-MM-DD` local, composite PK).
- One tap logs today. Tapping again on the same day undoes it.
- Streak per §4.4: consecutive local dates ending today, or yesterday if today is not yet
  checked. A missed day resets to zero. No rest days, no weekly-frequency habits.
- The streak count is the only statistic anywhere in the app (§1.1 item 7).
- The walk is trivial; the calendar is not. Test a midnight rollover and a device timezone
  change explicitly. This is where the bugs will be.
- Re-verify export/import: `habit_checks` is a new table in the export payload.

*Done when:* a habit checked on three consecutive days reads "3", skipping a day reads "0",
both survive an app restart, and neither breaks when the device timezone changes.

Built and green off device: migration 003, the streak walk with its calendar cases under
test, the habit row, and the export round trip re-verified with `habit_checks` in the
payload. The clock is injected, so the midnight and timezone cases are tests rather than
things to take on trust — but the device still has to confirm them with a real clock.

---

## Phase 4 — Cookbook (§7 step 4) — AWAITING DEVICE CHECK

- `docs/modules/cookbook.md` first.
- `recipe` payload per §4.3: `servings`, `ingredients[{qty?, unit?, name}]`, ordered `steps[]`.
  `qty` and `unit` became optional on 2026-09-23 (owner’s decision; see `DECISIONS.md`).
- Payload validated on write and on read. It is JSON in a `TEXT` column and is never
  trusted to be well-formed, whatever the TypeScript types claim.
- Kitchen mode (§6)
  - Screen stays awake while a recipe is open.
  - Large type, readable at arm's length on a counter.
  - Primary actions in the lower half of the screen.
- Recipe content stays in whatever language it was typed in. Never normalised.

*Done when:* a recipe is followed start to finish on the phone, on a counter, without
touching the screen to keep it lit.

Built and green off device: the module spec, the amended payload, kitchen mode on the
platform Screen Wake Lock API, the editor, and a recipe export round trip. The wake lock
is the open question — the desktop test pane refused it with `NotAllowedError`, which is
expected for a page that is not the focused foreground document, and only the phone can
say whether the WebView grants it. If it refuses there, `@capacitor-community/keep-awake`
comes back with an ADR.

---

## Phase 5 — Reading queue with PDF viewer (§7 step 5)

- `docs/modules/reading-queue.md` first.
- Entry: title, optional URL, optional attached PDF, read status.
- Attachment per ADR-004: copy the file into the app's private data directory via
  `@capacitor/filesystem`; store the internal path in `payload.pdf_path`.
- Viewer: PDF.js. Restores `last_page`. No annotation, no highlighting, no margin notes
  (§1.1 item 8).
- Delete semantics per §4.1: soft-deleting a reading entry **retains** its PDF. Purge
  removes the row and the file together. Verify both halves.
- Export: PDFs are included by default now, so extend the export writer to copy
  `pdfs/` into the export container, add the exclude flag, and make import restore them.
  Re-verify the round trip with a real PDF attached.

*Done when:* a PDF is attached, the original is deleted from phone storage, the entry
still opens at the page it was left on, and an export/import round trip on a different
install reproduces the file.

---

## Phase 6 — Places to try (§7 step 6)

- `docs/modules/places.md` first.
- Name, optional note, optional `lat`/`lon` in payload.
- Coordinates are stored, not rendered. A map view means a new dependency, which §8
  forbids without an ADR.

*Done when:* a place is captured with and without coordinates, and both export cleanly.

---

## Phase 7 — Workout routine and exercise catalog (§7 step 7, built last)

- `docs/modules/workout.md` first. This module spec carries more weight than the others,
  because the catalog decision pushes real questions into it.
- Migration adds nothing to the schema: `exercise` is a new `items.type`, not a new table.
- Exercise catalog
  - `exercise` entities: title is the name, optional body for form cues. No payload.
  - A picker in the routine editor and in the workout flow. Creating an exercise inline
    from the picker is the difference between this being usable and being friction.
- `routine` payload: `exercises[{ exercise_id, sets, reps, load_kg }]`.
- `workout_log` payload: `routine_id` plus `performed[{ exercise_id, sets[{reps, load_kg}] }]`.
- **Referential integrity is the data layer's job here.** `exercise_id` lives inside JSON,
  so SQLite cannot enforce it (§4.1). Two questions the module spec must answer, not this
  roadmap: what happens when an exercise still referenced by a routine or a past log is
  deleted, and whether a log keeps working when its routine is deleted.
- Per-exercise history is a plain list of past sets. No charts, no progression graphs
  (§1.1 item 7).

*Done when:* an exercise is created, used in a routine, performed, logged, renamed in the
catalog, and the rename is visible in the past log; and the whole lot survives an
export/import round trip.

---

## Standing work in every phase

Not a phase. These apply from Phase 1 onward and are part of "done" every time.

- Spec first, code second. To change behaviour, edit `SPECS.md`, then reconcile the code
  (§8 process rule). Never patch code and leave the spec stale.
- Write the module spec for the current step only. Never more than one step ahead (§7).
- Every schema change ships as a numbered migration and bumps `schema_version` (§6).
  Shipped migrations are never edited; a mistake is fixed by the next migration.
- Re-verify the export/import round trip after every schema change. It is the only thing
  standing between the owner and total data loss (ADR-003).
- No new dependency without an ADR (§8).
- No new entity type without editing §4 first (§8).
- Nothing from §1.1 gets built, however convenient it looks mid-phase.
- Acceptance criteria verified on a real Android device, not only a desktop browser (§6).
- Every feature works with no network (§6). Verify in airplane mode, not by assertion.

---

## Gate register

| Gate | Item | Spec ref | Status | Blocks |
|---|---|---|---|---|
| D1 | ADR-001 Capacitor | §3 | CLOSED 2026-09-21 — accepted | — |
| D2 | ADR-002 SQLite | §3 | CLOSED 2026-09-21 — accepted | — |
| D3 | ADR-003 single device | §3 | CLOSED 2026-09-21 — accepted | — |
| D4 | ADR-004 PDF copy-on-import | §3 | CLOSED 2026-09-21 — accepted, amended | — |
| D5 | ADR-006 reuse policy | §3 | CLOSED 2026-09-21 — accepted | — |
| D6 | ADR-005 frontend framework | §3 | CLOSED 2026-09-21 — Preact + TS strict | — |
| D7 | §4.2 schema | §4.2 | CLOSED 2026-09-21 — accepted, 3 amendments | — |
| D8 | To-do due dates | §2.1 | CLOSED 2026-09-21 — no | — |
| D9 | PDF export default | §5 | CLOSED 2026-09-21 — included | — |
| D10 | Workout free text vs catalog | §4.3 | CLOSED 2026-09-21 — catalog | — |
| P1 | Quick capture prefix syntax | §2.2 | CLOSED 2026-09-21 — none | — |
| P2 | Rest days / weekly habits | §4.4 | CLOSED 2026-09-21 — neither | — |
| S1 | Soft delete vs PDF deletion | §4.1 | CLOSED 2026-09-21 — retain, purge removes | — |
| S2 | FTS and soft-deleted rows | §4.2 | CLOSED 2026-09-21 — filter at query time | — |
| F1 | Finance contradiction | §1.1 | CLOSED 2026-09-21 — no finance features | — |
| L1 | License | — | CLOSED 2026-09-21 — MIT | — |
| E1 | Export packaging: directory or zip | §5 | CLOSED 2026-09-21 — directory | — |
| V1 | FTS5 availability on device | ADR-002 | CLOSED 2026-09-21 — available | — |

Both device gates were closed on 2026-09-21, once Phase 1 put a build on the phone.
