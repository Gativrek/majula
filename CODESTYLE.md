# CODESTYLE.md — Majula

How the code is written. Binding on the production codebase.

**Precedence.** `SPECS.md` > `CODESTYLE.md` > personal preference. If a rule here
conflicts with the spec, the spec wins and this file gets fixed.

**Scope.** ADR-005 is ACCEPTED: Preact with JSX aliased from React, Vite, TypeScript in
strict mode. §1 through §11 are stack-general and hold regardless; §12 carries the
Preact-specific rules.

---

## 1. Language

- **Everything a developer writes is in English.** Identifiers, comments, log messages,
  error messages, commit messages, branch names, documentation, ADRs, module specs,
  test names, migration filenames. No exceptions, no mixed-language identifiers.
- **Everything the user types is stored verbatim.** A recipe written in Portuguese stays
  in Portuguese. User content is never translated, normalised, transliterated or
  case-folded on the way into the database.
- UI copy language is a product decision, not a style rule. It belongs in the module specs.
- No abbreviations that are not already standard in the domain. `qty` and `id` are fine
  because the spec uses them; `rcp`, `hbtChk` and `usrDat` are not.

## 2. Formatting

- Formatting is not a judgement call. A formatter owns it, its config is committed, and
  it runs on every file.
- Run the formatter in a pre-commit hook. A commit that would change under the formatter
  does not get made.
- Never hand-format to "look better". If the formatter's output is wrong, change the
  config, commit the config change, and reformat the repository in a commit of its own.
- Commit an `.editorconfig`. LF line endings in the repository, enforced through
  `.gitattributes` — the working copy is on Windows and the build runs on Linux; CRLF
  leaking into the repository makes every later diff unreadable.
- Reformatting commits contain nothing but reformatting.

## 3. Naming

- `camelCase` for variables and functions, `PascalCase` for types and classes,
  `SCREAMING_SNAKE_CASE` for true constants, `kebab-case` for filenames.
- `snake_case` for everything inside SQL: tables, columns, indexes. This matches §4.2
  and is the one place the JavaScript convention does not apply.
- Names say what the thing is, not what shape it has. `items` over `itemArray`,
  `habitChecks` over `habitCheckList`.
- Booleans read as assertions: `isDeleted`, `hasPdf`, `canExport`.
- Functions that perform an action are verbs: `exportDatabase`, not `databaseExport`.
- One name per concept across the whole codebase. If the spec calls it a `payload`, the
  code calls it a payload everywhere — never `data`, `extra` or `meta` in one layer and
  `payload` in another.

## 4. Structure

- Layers, one direction only: **UI → service → data**. The UI never issues SQL, never
  touches the filesystem, and never parses a payload. The data layer never knows what a
  screen is.
- Every SQL statement lives in the data layer. One module per entity concern, not one
  giant `db.js`.
- A file exports one coherent thing. A file that needs a section comment to separate two
  unrelated halves is two files.
- Soft ceiling of ~200 lines per file and ~40 lines per function. Crossing it is a
  prompt to look, not an error.
- No cyclic imports. No barrel files that re-export half the codebase to shorten an
  import path.
- Module boundaries are where errors get translated: the data layer throws storage errors,
  the service layer turns them into something the UI can act on.
- Dead code is deleted, not commented out. Git remembers it.

## 5. Comments

- **Comments are the exception.** Code that needs a comment to be understood is usually
  code that needs rewriting first.
- When a comment is necessary, it is **technical and specific**. It explains *why* —
  a constraint, a platform quirk, a non-obvious consequence — never *what* the line does.
- **No vague comments.** `// handle the data`, `// important`, `// fix later`,
  `// magic` and anything that restates the code are not acceptable. Delete them.
- No commented-out code. No decorative banners, no ASCII dividers, no author tags,
  no change logs in file headers.
- A `TODO` carries a reference to the spec section or the issue it depends on, or it is
  not written. `// TODO: revisit` is noise.
- Where a constraint comes from the spec, cite it: `// SPECS §4.4: a missed day resets
  the streak to zero`. Where it comes from the platform, name the platform and the
  behaviour.
- Public boundaries — the data layer's API, payload shapes, the export format — carry
  JSDoc. Internal helpers do not.

## 6. Debuggability

The app runs on one phone, in a WebView, with no crash reporting and no second user to
reproduce anything. Every bug must be diagnosable from what the app already records.

- **One logger module.** Levels: `debug`, `info`, `warn`, `error`. Nothing anywhere else
  calls `console.*` directly.
- Log messages are structured and searchable: a stable event name plus fields, not a
  prose sentence with values interpolated into it.
- **Never swallow an error.** Every `catch` either handles the error meaningfully or
  rethrows it with added context using the `cause` option. An empty catch block, or one
  containing only a log line, is a bug.
- **No silent fallbacks.** Where the code takes an alternative path — the `LIKE` search
  fallback when FTS5 is unavailable, an import from an older schema version, a missing
  PDF file — it logs which path it took and why, at `info` or above.
- Invariant violations fail fast and loudly. An unknown `items.type`, a payload that does
  not match its type, or a `schema_version` ahead of the binary are not recoverable
  states; do not paper over them.
- Errors thrown across a layer boundary carry enough context to locate the operation:
  the entity type and id, never the user's content.
- Name your functions. Anonymous callbacks passed to async plumbing produce stack traces
  that point nowhere.
- The migration runner logs `schema_version` from → to, and the outcome, on every run.
- Debug builds ship source maps. The commit hash is visible somewhere in the app.
- `Date.now()` and UUID generation are injected, not called inline, so streak logic and
  export can be tested deterministically.
- Logs never contain note bodies, recipe text, contact details or file contents.

## 7. Errors and failure

- Throw `Error` subclasses with meaningful names, never bare strings.
- Validate at the boundary: anything read from the database payload, an imported JSON
  file, or a filesystem path is untrusted until parsed and checked.
- A failed write leaves the database unchanged. Multi-statement writes run in a
  transaction.
- User-visible failure states say what failed and what the user can do. They do not
  print stack traces and they do not fail silently.

## 8. Asynchrony

- `async`/`await` throughout. No raw `.then()` chains, no mixing the two styles.
- Every promise is awaited or explicitly handed to something that handles rejection.
  No floating promises.
- Concurrent independent work uses `Promise.all`; sequential `await` in a loop is for
  work that is actually sequential.
- No `setTimeout` as a synchronisation mechanism.

## 9. Types

TypeScript, `strict` on. Settled by ADR-005.

- No `any`. No non-null assertions outside tests. No `@ts-ignore` without a comment
  naming the reason and the issue it waits on; `@ts-expect-error` where it applies.
- `items.type` is a discriminated union and payload shapes are typed per variant. The
  compiler, not a comment, is what stops a `recipe` payload reaching `routine` code.
- **A runtime check guards every JSON boundary.** Static types do not survive
  `JSON.parse`, and `payload` is `TEXT` in a column that a previous schema version, a
  hand-edited export, or a partial write could have left in any shape. Parse, validate,
  then narrow — never cast.
- The same applies to imported export files. An import is untrusted input.
- Types are declared once, in the data layer, and imported from there. A component that
  redeclares the shape of a recipe is a second source of truth.

## 10. SQL and the data layer

- **Parameterised queries only.** No string interpolation into SQL, ever, including for
  table and column names.
- Every schema change is a **numbered, forward-only migration** that bumps
  `schema_version`. A shipped migration is never edited; a mistake is fixed by the next
  migration.
- FTS triggers ship in the same migration as the virtual table they keep in sync.
- Every read filters `deleted_at IS NULL` unless it is one of the named exceptions: the
  Deleted view, the purge path, and resolving a reference from a routine or workout log
  (`src/data/references.ts`). The last exists because a past workout must still show an
  exercise that has since been deleted (`docs/modules/workout.md`); it resolves names by
  id and never lists. Soft delete that leaks into a list view is a data-loss bug in the
  other direction.
- Search filters deleted rows at query time, by joining `items_fts` back to `items` on
  `rowid`. Do not make the sync triggers conditional on `deleted_at`; the undelete path
  would be exercised too rarely to stay correct.
- `PRAGMA foreign_keys = ON` on every connection. Without it SQLite silently treats
  `REFERENCES` as a comment, and the constraint you think you have does not exist.
- References stored inside `payload` JSON (`exercise_id`, `routine_id`) cannot be enforced
  by SQLite at all. The data layer checks them on write and on read, and a dangling
  reference is a logged error, not a blank screen.
- Soft delete retains attached files; only purge removes them. A delete path that unlinks
  a file is a bug (§4.1).
- Timestamps are ISO 8601 UTC strings. Habit dates are local `YYYY-MM-DD`. These are two
  different types with two different helpers and they are never passed to each other's
  functions.
- Money is integer cents, never floats. Reserved: no module currently stores money
  (§1.1 item 12). The rule stands so a future one cannot get it wrong.
- `payload` is validated on write and on read. It is text in a column and is not trusted
  to be well-formed JSON, let alone the right shape.
- Per §4.1: if a module needs a field that neither the generic columns nor a small
  payload holds cleanly, stop and revisit the module. Do not widen the schema quietly.
- No new entity type without editing `SPECS.md` §4 first.

## 11. Dependencies, git and tests

- **No new dependency without an ADR.** Prefer a platform API, then a small well-scoped
  package, then nothing. A dependency added for one function is a dependency not worth
  having.
- The lockfile is committed. Builds are reproducible.
- One logical change per commit. Commit messages in English, imperative mood, subject
  line under ~72 characters, body explaining why when it is not obvious.
- No commit leaves the build broken or the formatter unhappy.
- Tests exist for the things that are quietly wrong rather than loudly broken: the streak
  calculation across midnight and timezone changes, the export/import round trip, every
  migration, and payload validation.
- Acceptance criteria are verified on a real Android device, not only in a desktop
  browser (`SPECS.md` §6).
- Offline behaviour is verified in airplane mode, not asserted.

## 12. Preact

- JSX is authored React-style. `react` and `react-dom` are aliased to `preact/compat` in
  the Vite config; import from `react`, not from `preact`, so the codebase reads as
  ordinary React and the alias stays a build detail.
- Before adding any React-ecosystem package, check it against `preact/compat`. Anything
  reaching into React internals will not work, and discovering that after it is wired
  through three screens is expensive. A package that fails the check needs an ADR
  proposing an alternative, not a shim.
- Function components only. No class components.
- Components render; they do not query. A component calls a service function, never the
  data layer and never SQL (§4).
- One component per file, named the same as the file.
- Local state stays local. Shared state lives in one store module with typed accessors,
  not in a context wrapping the whole app to avoid prop drilling three levels.
- Keys on list items are the entity `id`, never the array index. Items get soft-deleted
  and re-ordered; index keys will silently render the wrong row.
- Effects declare complete dependency arrays and return a cleanup function whenever they
  subscribe, time, or open anything. An effect that both fetches and subscribes is two
  effects.
- No business logic in JSX. If a render branch needs a comment to follow, it belongs in a
  named function above the return.
- Styling is plain CSS with custom properties for the gold-on-black theme. Kitchen mode's
  large type is a theme variable, not a per-component override. A category's accent
  (SPECS §2.2, Look and motion) redefines the gold tokens under `[data-cat]`, so a rule
  that reads a token follows it; a literal colour does not, and is a bug unless it is fire.
- Motion lives in `motion.css`, all of it inside `prefers-reduced-motion: no-preference`.
  An animation decorates a change already made; nothing waits on one.
