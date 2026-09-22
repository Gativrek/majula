/**
 * A faithful port of the Android plugin's SQL statement splitter.
 *
 * `@capacitor-community/sqlite` does not hand a script to SQLite whole. It splits it on
 * `";\n"` and runs the pieces one at a time, then tries to put triggers back together
 * again. `node:sqlite`'s `exec()` has no such behaviour, so a migration can pass every
 * test here and still fail on the phone — which is exactly what happened to migration
 * 002 and cost a device round trip to find.
 *
 * Ported from `UtilsSQLite.getStatementsArray` in the plugin's Android source. Keep it
 * matching that method; it is the contract migrations actually run under.
 */

/** Java's `String.split` discards trailing empty strings; JavaScript's does not. */
function javaSplit(value: string, separator: string): string[] {
  const parts = value.split(separator);
  while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
  return parts;
}

/**
 * The plugin's trigger reassembly: it looks for a fragment that is exactly `END` and
 * glues it onto the one before it. A trigger body holding more than one statement
 * therefore stays broken, because only the last fragment is rejoined.
 */
function concatRemoveEnd(fragments: string[]): string[] {
  const result = [...fragments];
  const index = result.indexOf('END');
  if (index === -1) return result;
  result[index - 1] = `${result[index - 1] ?? ''}; END`;
  result.splice(index, 1);
  return concatRemoveEnd(result);
}

/** Collapse a multi-line statement onto one line, dropping `--` comments as it goes. */
function flatten(statement: string): string {
  return statement
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const comment = trimmed.indexOf('--');
      return comment > -1 ? trimmed.slice(0, comment) : trimmed;
    })
    .filter((line) => line.length > 0)
    .join(' ');
}

/** The statements the plugin will actually execute, in order. */
export function splitLikeCapacitor(script: string): string[] {
  const normalised = script.split('end;').join('END;');
  const fragments = concatRemoveEnd(javaSplit(normalised, ';\n').map((part) => part.trim()));
  const statements = fragments.map(flatten);
  if (statements.length > 0 && (statements[statements.length - 1] ?? '').trim().length === 0) {
    statements.pop();
  }
  return statements;
}
