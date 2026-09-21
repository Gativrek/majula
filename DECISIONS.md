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
