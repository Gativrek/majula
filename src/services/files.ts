/**
 * The filesystem surface the service layer is written against (ADR-001, ADR-004).
 *
 * Two implementations, for the same reason as {@link SqlDriver}: the Capacitor plugin
 * on the device, and an in-memory one under `node --test`.
 */

import { base64ToBytes, bytesToBase64 } from '../lib/base64.ts';
import { StorageError } from '../lib/errors.ts';
import { log } from '../lib/logger.ts';

/**
 * Where a path is rooted. `export` is user-accessible storage — the export container
 * has to be reachable from a file manager or it is not a backup. `private` is the
 * app's own data directory, where attached PDFs are copied (ADR-004).
 */
export type StorageRoot = 'export' | 'private';

export interface FileStore {
  ensureDirectory(root: StorageRoot, path: string): Promise<void>;
  writeText(root: StorageRoot, path: string, contents: string): Promise<void>;
  readText(root: StorageRoot, path: string): Promise<string>;
  /** Binary files — attached PDFs (ADR-004). */
  writeBytes(root: StorageRoot, path: string, bytes: Uint8Array): Promise<void>;
  readBytes(root: StorageRoot, path: string): Promise<Uint8Array>;
  exists(root: StorageRoot, path: string): Promise<boolean>;
  listDirectory(root: StorageRoot, path: string): Promise<string[]>;
  copyFile(
    from: { root: StorageRoot; path: string },
    to: { root: StorageRoot; path: string },
  ): Promise<void>;
  deleteFile(root: StorageRoot, path: string): Promise<void>;
}

/** The export container's directory name inside user-accessible storage (SPECS §5). */
export const EXPORT_DIRECTORY = 'Majula';
export const EXPORT_FILE_NAME = 'majula-export.json';
export const EXPORT_PDF_DIRECTORY = 'pdfs';

export async function createDeviceFileStore(): Promise<FileStore> {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');

  const directoryFor: Record<StorageRoot, (typeof Directory)[keyof typeof Directory]> = {
    export: Directory.Documents,
    private: Directory.Data,
  };

  async function ensureDirectory(root: StorageRoot, path: string): Promise<void> {
    try {
      await Filesystem.mkdir({ path, directory: directoryFor[root], recursive: true });
    } catch (cause) {
      // The plugin throws when the directory already exists; anything else is real.
      const message = cause instanceof Error ? cause.message : String(cause);
      if (!message.toLowerCase().includes('exist')) {
        throw new StorageError('mkdir failed', { operation: 'ensureDirectory' }, { cause });
      }
      log.debug('files.directory_present', { path });
    }
  }

  return {
    ensureDirectory,

    async writeText(root, path, contents) {
      await Filesystem.writeFile({
        path,
        data: contents,
        directory: directoryFor[root],
        encoding: Encoding.UTF8,
        recursive: true,
      });
    },

    async readText(root, path) {
      const result = await Filesystem.readFile({
        path,
        directory: directoryFor[root],
        encoding: Encoding.UTF8,
      });
      if (typeof result.data !== 'string') {
        throw new StorageError('expected UTF-8 text', { operation: 'readText' });
      }
      return result.data;
    },

    async writeBytes(root, path, bytes) {
      // No `encoding`: the plugin then treats `data` as base64 and writes raw bytes.
      await Filesystem.writeFile({
        path,
        data: bytesToBase64(bytes),
        directory: directoryFor[root],
        recursive: true,
      });
    },

    async readBytes(root, path) {
      const result = await Filesystem.readFile({ path, directory: directoryFor[root] });
      if (typeof result.data !== 'string') {
        throw new StorageError('expected base64 from the native bridge', {
          operation: 'readBytes',
        });
      }
      return base64ToBytes(result.data);
    },

    async exists(root, path) {
      try {
        await Filesystem.stat({ path, directory: directoryFor[root] });
        return true;
      } catch {
        return false;
      }
    },

    async listDirectory(root, path) {
      const result = await Filesystem.readdir({ path, directory: directoryFor[root] });
      return result.files.map((entry) => entry.name);
    },

    async copyFile(from, to) {
      await Filesystem.copy({
        from: from.path,
        directory: directoryFor[from.root],
        to: to.path,
        toDirectory: directoryFor[to.root],
      });
    },

    async deleteFile(root, path) {
      await Filesystem.deleteFile({ path, directory: directoryFor[root] });
    },
  };
}
