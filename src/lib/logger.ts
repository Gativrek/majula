/**
 * The one logger in the codebase. Nothing else calls `console.*` (CODESTYLE §6).
 *
 * Messages are a stable event name plus fields, so they can be grepped in logcat.
 * Fields never carry user content: no note bodies, recipe text, contact details or
 * file contents (CODESTYLE §6).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, string | number | boolean | null | undefined>;

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const CONSOLE_METHOD: Record<LogLevel, 'debug' | 'info' | 'warn' | 'error'> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

let minimumLevel: LogLevel = import.meta.env?.PROD ? 'info' : 'debug';

export function setLogLevel(level: LogLevel): void {
  minimumLevel = level;
}

function formatFields(fields: LogFields): string {
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
}

function emit(level: LogLevel, event: string, fields: LogFields): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minimumLevel]) return;
  const formatted = formatFields(fields);
  // eslint-disable-next-line no-console -- CODESTYLE §6: this is the single sink.
  console[CONSOLE_METHOD[level]](formatted ? `${event} ${formatted}` : event);
}

export const log = {
  debug: (event: string, fields: LogFields = {}) => emit('debug', event, fields),
  info: (event: string, fields: LogFields = {}) => emit('info', event, fields),
  warn: (event: string, fields: LogFields = {}) => emit('warn', event, fields),
  error: (event: string, fields: LogFields = {}) => emit('error', event, fields),
};
