import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { probeFts5 } from '../src/data/fts-probe.ts';
import { setLogLevel } from '../src/lib/logger.ts';
import { openTestDatabase } from './support/driver-node.ts';

setLogLevel('error');

describe('GATE V1 FTS5 probe', function probeSuite() {
  it('reports a definite answer and leaves no table behind', async function probe() {
    const driver = openTestDatabase();
    const availability = await probeFts5(driver);
    assert.ok(availability === 'available' || availability === 'unavailable');

    const leftovers = await driver.query<{ name: string }>(
      "SELECT name FROM sqlite_temp_master WHERE name = 'fts_probe'",
    );
    assert.deepEqual(leftovers, [], 'the probe must not leave a table in the schema');
    await driver.close();
  });
});
