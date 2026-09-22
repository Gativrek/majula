import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MIGRATIONS } from '../src/data/migrations.ts';
import { setLogLevel } from '../src/lib/logger.ts';
import { openTestDatabase } from './support/driver-node.ts';
import { splitLikeCapacitor } from './support/capacitor-splitter.ts';

setLogLevel('error');

/**
 * Migrations must survive the Android plugin's statement splitter, not just
 * `node:sqlite`'s `exec()`. Migration 002 passed every other test in this suite and
 * still failed on the phone, because a trigger body with two statements in it comes out
 * of that splitter in pieces.
 *
 * This runs each migration the way the device will actually run it.
 */
describe('migrations under the Capacitor statement splitter', function splitterSuite() {
  it('splits a two-statement trigger body into something SQLite rejects', function theBug() {
    // The shape migration 002 originally had. Kept as a regression witness: if the
    // plugin ever learns to handle this, this test says so out loud.
    const broken = [
      'CREATE TRIGGER t AFTER UPDATE ON items BEGIN',
      "  INSERT INTO items_fts (items_fts, rowid) VALUES ('delete', old.rowid);",
      '  INSERT INTO items_fts (rowid) VALUES (new.rowid);',
      'END;',
    ].join('\n');

    const statements = splitLikeCapacitor(broken);
    assert.ok(
      statements.length > 1,
      'the splitter tears the trigger apart; only the final END is rejoined',
    );
    assert.ok(
      (statements[0] ?? '').includes('BEGIN') && !(statements[0] ?? '').includes('END'),
      'the CREATE TRIGGER fragment is left unterminated',
    );
  });

  it('keeps every migration in one piece per statement', function wholeStatements() {
    for (const migration of MIGRATIONS) {
      for (const statement of splitLikeCapacitor(migration.sql)) {
        const opensTrigger = /\bBEGIN\b/.test(statement) && /CREATE\s+TRIGGER/i.test(statement);
        if (opensTrigger) {
          assert.ok(
            /\bEND\s*;?\s*$/.test(statement),
            `migration ${migration.version} leaves a trigger unterminated: ${statement}`,
          );
        }
        assert.ok(
          !/^END\b/i.test(statement),
          `migration ${migration.version} produced an orphaned END: ${statement}`,
        );
      }
    }
  });

  it('applies every migration through the splitter and leaves a working schema', async function applied() {
    const driver = openTestDatabase();

    for (const migration of MIGRATIONS) {
      for (const statement of splitLikeCapacitor(migration.sql)) {
        if (statement.trim().length === 0) continue;
        await driver.executeScript(`${statement};`);
      }
    }

    const objects = await driver.query<{ name: string; type: string }>(
      "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'trigger')",
    );
    const names = objects.map((row) => row.name);
    for (const expected of [
      'items',
      'tags',
      'items_fts',
      'habit_checks',
      'items_fts_after_insert',
      'items_fts_after_update',
      'items_fts_after_delete',
    ]) {
      assert.ok(names.includes(expected), `${expected} was not created`);
    }

    // The update trigger is the one the splitter broke, so prove it actually works:
    // an edited title must leave the index and the new one must enter it.
    await driver.run(
      'INSERT INTO items (id, type, title, body, done, payload, created_at, updated_at) ' +
        "VALUES ('id-1', 'note', 'Before', 'body text', 0, '{}', '2026-09-21T12:00:00.000Z', " +
        "'2026-09-21T12:00:00.000Z')",
    );
    await driver.run("UPDATE items SET title = 'After' WHERE id = 'id-1'");

    const before = await driver.query<{ title: string }>(
      "SELECT title FROM items_fts WHERE items_fts MATCH 'Before'",
    );
    const after = await driver.query<{ title: string }>(
      "SELECT title FROM items_fts WHERE items_fts MATCH 'After'",
    );
    assert.equal(before.length, 0, 'the old title must leave the index');
    assert.equal(after.length, 1, 'the new title must enter it');

    await driver.close();
  });
});
