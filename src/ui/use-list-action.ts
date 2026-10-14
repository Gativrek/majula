import { useCallback, useState } from 'react';
import { log } from '../lib/logger.ts';

/**
 * Run something a list row asked for — check off, delete, log a habit, restore — then
 * reload the list, and say so if either fails (CODESTYLE §7, §8). A tap on a row returns
 * nothing to wait for, so without this a failed write would be an unhandled rejection and
 * the row would simply not change.
 */

export interface ListAction {
  problem: string | null;
  dismiss: () => void;
  /** Await `work`, then reload. */
  run: (work: Promise<unknown>) => Promise<void>;
  /** Reload alone, as when the view changes. */
  load: () => Promise<void>;
  /** Say that something this list started has failed, when it was not run through `run`. */
  report: (error: unknown) => void;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown failure';
}

export function useListAction(refresh: () => Promise<void>): ListAction {
  const [problem, setProblem] = useState<string | null>(null);

  // Stable while `refresh` is, so a screen can load in an effect keyed on it.
  const load = useCallback(
    async function loadList(): Promise<void> {
      try {
        await refresh();
      } catch (error) {
        log.error('list.load_failed', { reason: error instanceof Error ? error.name : 'unknown' });
        setProblem(`The list could not be read: ${reasonOf(error)}.`);
      }
    },
    [refresh],
  );

  function report(error: unknown): void {
    log.error('list.action_failed', { reason: error instanceof Error ? error.name : 'unknown' });
    setProblem(`That did not save: ${reasonOf(error)}.`);
  }

  async function run(work: Promise<unknown>): Promise<void> {
    try {
      await work;
    } catch (error) {
      report(error);
      return;
    }
    await load();
  }

  return { problem, dismiss: () => setProblem(null), run, load, report };
}
