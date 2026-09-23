import { StartupError } from '../services/database.ts';

/**
 * What the owner sees when the app cannot start. Each stage has a different cause and a
 * different next step, so the banner says which one it was rather than guessing at the
 * most likely — an earlier version blamed the browser for a failing migration
 * (DECISIONS.md, 2026-09-22).
 */

export interface StartupFailure {
  stage: 'open' | 'migrate' | 'files' | 'unknown';
  detail: string;
}

export function startupFailureFrom(error: unknown): StartupFailure {
  return {
    stage: error instanceof StartupError ? error.stage : 'unknown',
    detail: error instanceof Error ? error.message : 'an unknown failure',
  };
}

function advice(failure: StartupFailure): string {
  switch (failure.stage) {
    case 'open':
      return 'SQLite is a native plugin, so this happens in a desktop browser. On the phone it means the database could not be opened at all.';
    case 'migrate':
      return 'The database opened but its schema could not be brought up to date. The data is untouched; the logs carry the failing migration under migration.start.';
    case 'files':
      return 'The database is fine, but app storage could not be reached, so export and import will not work.';
    default:
      return 'Startup failed before the app could tell what went wrong.';
  }
}

export function StartupBanner({ failure }: { failure: StartupFailure }) {
  return (
    <p class="banner banner--error">
      Majula could not start ({failure.stage}): {failure.detail}. {advice(failure)}
    </p>
  );
}
