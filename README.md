# Majula

A personal all-in-one capture app for one Android phone. Notes, to-dos, reading queue,
network log, habit streaks, a running-low list, a cookbook, workout logs and places to try —
all in one place, all offline, all on the device.

> **This is built for one person and is not supported.**
> It is published here because the code may be useful to read, not because it is a product.
> No issue triage, no feature requests, no support. Fork it if you want it.

---

## What it is

The phone is a capture surface and a glance view: an idea on the bus, a recipe while
cooking, a tap to log a habit. Review, organisation and deep work happen elsewhere —
the computer, a notebook, paper.

**The design test applied to every feature:** can it be done in seconds, one-handed,
with no signal? If not, it is not in this app.

---

## What it does

One tap from the home screen opens quick capture. It defaults to a note; a row of chips
switches the type. Everything else is a view over the same store.

| Module | What it captures |
|---|---|
| **Notes** | Free text, optional tags |
| **To-do** | Text, done flag |
| **Reading queue** | Title, optional URL, optional attached PDF, read status |
| **Network log** | Who you met, where, and a line of context |
| **Habit streak** | One tap logs today; shows the current streak |
| **Running-low list** | Tap to add when you notice; check off when bought |
| **Cookbook** | Ingredients, ordered steps, servings |
| **Workout routine** | Routine templates and session logs, over an exercise catalog |
| **Places to try** | Name, note, optional coordinates |

Across all of them:

- **Global search** over the title and body of every entity.
- **Tag views** — saved filters over the single item store. Most modules are views,
  not separate screens with separate storage.
- **Kitchen mode** — an open recipe keeps the screen awake and uses large type.
- **Export and backup** — see below. Not optional.

Primary actions sit in the lower half of the screen. Cold start to typing in quick
capture is under about two seconds on the phone it was built for.

---

## What it deliberately does not do

These are not missing features. They are decisions.

- No accounts, no login, no credentials of any kind.
- No sync, no server, no cloud. One device.
- No calendar.
- No analytics, charts or statistics screens. The habit streak count is the only number.
- No PDF annotation, highlighting or margin notes.
- No pantry quantities or depletion logic. The running-low list is a list.
- No follow-up or review workflow on the network log. It captures; that is all.
- No question bank or study tools.
- No budgeting, spending charts or finance dashboards. Money is a separate concern, and
  this app is neither upstream nor downstream of one.
- No integration with, or migration from, the owner's other projects.
- No settings for preferences the owner does not personally have.
- No abstractions for hypothetical users.

---

## Your data

- Everything lives in a SQLite database on the phone. Nothing leaves the device.
- Every feature works with no network. This is not a degraded mode; it is the only mode.
- **Losing the phone loses the data** unless it has been exported. Export is therefore a
  hard requirement, not a nice-to-have.
- **Export** writes all tables to `majula-export.json` in user-accessible storage, tagged
  with its schema version, alongside a `pdfs/` directory holding every attached PDF.
  A flag excludes the PDFs for a quick data-only dump.
- **Import** restores from that export by replacing the database, not merging into it.
  It refuses exports from a newer schema version and migrates older ones.
- Desktop review of phone data happens through export, not sync.
- Attached PDFs are copied into the app's private storage on import, so links never break
  when the original is moved, renamed or deleted. Because that copy is often the only one
  left, exports include it by default.
- Deletes are soft and keep their attached files. A separate purge action is what actually
  removes a row and its PDF, so an accidental delete is recoverable until you purge.

---

## How it is built

- **Packaging:** Capacitor wrapping a web frontend. Android is the only target; iOS is
  not planned.
- **Frontend:** Preact, authored with JSX aliased from React, bundled with Vite.
  TypeScript in strict mode — `items.type` is a discriminated union with a payload shape
  per variant, which is where a wrong shape would otherwise fail silently.
- **Storage:** SQLite via `@capacitor-community/sqlite`, with full-text search through
  FTS5 where the bundled build supports it and a `LIKE` fallback where it does not.
- **PDFs:** copied into private app storage on attach, rendered with PDF.js, last page
  remembered.
- **Schema:** a single generic `items` table with a JSON payload for type-specific fields,
  plus `tags` and an event table for habit check-ins. Soft deletes. Timestamps in ISO 8601
  UTC; habit dates as local `YYYY-MM-DD`. Workout exercises are catalog entities referenced
  by id, so renaming one propagates to every routine and every past log.
- **Migrations:** numbered, forward-only, each bumping the stored schema version.

---

## Look

Gold and yellow on black. The app icon is a Dark Souls II bonfire — gold flame, black
background.

---

## Install

Android only. Build the debug APK and install it on the device; there is no release
channel and no store listing.

Build and run commands are in `CLAUDE.md`.

---

## Repository layout

| File | What it is |
|---|---|
| `SPECS.md` | The source of truth. Product brief, non-goals, modules, ADRs, data model. |
| `ROADMAP.md` | Build order, phase by phase, with the decisions that gate each one. |
| `CODESTYLE.md` | How the code is written and kept debuggable. |
| `CLAUDE.md` | Agent operating manual: commands, layout, standing rules. |
| `DECISIONS.md` | Append-only log. One dated line per change of mind. |
| `LICENSE` | MIT. |
| `docs/modules/` | Per-module acceptance criteria. Observable behaviour only. |
| `docs/adr/` | Architecture decision records, once they outgrow `SPECS.md` §3. |

**The process rule:** to change behaviour, edit the spec first, then reconcile the code.
Never patch code and leave the spec stale.

---

## Status

In development. `ROADMAP.md` has the current phase and what still blocks it.

---

## License

MIT. See `LICENSE`.
