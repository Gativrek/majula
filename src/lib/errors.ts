/**
 * Error subclasses thrown across layer boundaries (CODESTYLE §7).
 *
 * Every one carries enough context to locate the operation — entity type and id —
 * and never the user's content.
 */

export interface StorageContext {
  operation: string;
  type?: string | undefined;
  id?: string | undefined;
}

export interface ValidationContext {
  subject: string;
  type?: string | undefined;
  id?: string | undefined;
}

/** The data layer failed to read or write storage. */
export class StorageError extends Error {
  override readonly name = 'StorageError';
  readonly context: StorageContext;

  constructor(message: string, context: StorageContext, options?: { cause?: unknown }) {
    super(message, options);
    this.context = context;
  }
}

/** Untrusted input — a `payload` column, an import file — did not match its shape. */
export class ValidationError extends Error {
  override readonly name = 'ValidationError';
  readonly context: ValidationContext;

  constructor(message: string, context: ValidationContext, options?: { cause?: unknown }) {
    super(message, options);
    this.context = context;
  }
}

/**
 * A state that cannot be recovered from and must not be papered over: an unknown
 * `items.type`, a `schema_version` ahead of the binary (CODESTYLE §6).
 */
export class InvariantError extends Error {
  override readonly name = 'InvariantError';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}
