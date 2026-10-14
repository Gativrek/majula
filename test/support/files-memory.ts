/**
 * An in-memory {@link FileStore} for the export/import round trip test.
 *
 * Directories are implicit: a path exists if it is a stored file or a prefix of one.
 */

import type { FileStore, StorageRoot } from '../../src/services/files.ts';

export interface MemoryFileStore extends FileStore {
  /** Every stored path, for assertions about what an export actually wrote. */
  paths(root: StorageRoot): string[];
  put(root: StorageRoot, path: string, contents: string): void;
  /** A stored file's bytes, for assertions about what was copied. */
  readBytes(root: StorageRoot, path: string): Promise<Uint8Array>;
}

export function createMemoryFileStore(): MemoryFileStore {
  const files: Record<StorageRoot, Map<string, string | Uint8Array>> = {
    export: new Map(),
    private: new Map(),
  };
  const directories: Record<StorageRoot, Set<string>> = {
    export: new Set(),
    private: new Set(),
  };

  function readOrThrow(root: StorageRoot, path: string): string | Uint8Array {
    const contents = files[root].get(path);
    if (contents === undefined) throw new Error(`no such file: ${root}:${path}`);
    return contents;
  }

  return {
    paths(root) {
      return [...files[root].keys()].sort();
    },

    put(root, path, contents) {
      files[root].set(path, contents);
    },

    async ensureDirectory(root, path) {
      directories[root].add(path);
    },

    async writeText(root, path, contents) {
      files[root].set(path, contents);
    },

    async readText(root, path) {
      const contents = readOrThrow(root, path);
      if (typeof contents !== 'string') throw new Error(`binary file read as text: ${path}`);
      return contents;
    },

    async writeBytes(root, path, bytes) {
      files[root].set(path, new Uint8Array(bytes));
    },

    async appendBytes(root, path, bytes) {
      const before = readOrThrow(root, path);
      if (typeof before === 'string') throw new Error(`text file appended as bytes: ${path}`);
      const joined = new Uint8Array(before.length + bytes.length);
      joined.set(before);
      joined.set(bytes, before.length);
      files[root].set(path, joined);
    },

    async fileUrl(root, path) {
      readOrThrow(root, path);
      return `memory://${root}/${path}`;
    },

    async readBytes(root, path) {
      const contents = readOrThrow(root, path);
      return typeof contents === 'string' ? new TextEncoder().encode(contents) : contents;
    },

    async exists(root, path) {
      if (files[root].has(path) || directories[root].has(path)) return true;
      return [...files[root].keys()].some((candidate) => candidate.startsWith(`${path}/`));
    },

    async listDirectory(root, path) {
      const prefix = `${path}/`;
      return [...files[root].keys()]
        .filter((candidate) => candidate.startsWith(prefix))
        .map((candidate) => candidate.slice(prefix.length))
        .filter((name) => !name.includes('/'))
        .sort();
    },

    async copyFile(from, to) {
      files[to.root].set(to.path, readOrThrow(from.root, from.path));
    },

    async deleteFile(root, path) {
      if (!files[root].delete(path)) throw new Error(`no such file: ${root}:${path}`);
    },
  };
}
