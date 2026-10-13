/**
 * Text shared to Majula from another app, as handed over by the in-app ShareInbox plugin
 * (`android/.../ShareInboxPlugin.java`, `docs/modules/places.md` 15–21).
 *
 * The plugin exists only in the Android build. In a desktop browser nothing is listening
 * and nothing arrives, which is the correct behaviour rather than a failure to report.
 */

import type { PluginListenerHandle } from '@capacitor/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { log } from '../lib/logger.ts';

export interface SharedText {
  text: string;
  subject?: string;
}

interface ShareInboxPlugin {
  addListener(event: 'share', listener: (share: unknown) => void): Promise<PluginListenerHandle>;
}

const ShareInbox = registerPlugin<ShareInboxPlugin>('ShareInbox');

/** What crosses the bridge is checked before use; it came from another app (CODESTYLE §9). */
function asSharedText(value: unknown): SharedText | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.text !== 'string') return null;
  return typeof record.subject === 'string'
    ? { text: record.text, subject: record.subject }
    : { text: record.text };
}

/**
 * Call `onShare` for every text share, including one that started the app: the plugin
 * holds that share until this listener attaches.
 *
 * @returns a function that stops listening, shaped for an effect's cleanup.
 */
export function listenForShares(onShare: (share: SharedText) => void): () => void {
  if (!Capacitor.isPluginAvailable('ShareInbox')) {
    log.debug('share.unavailable', {});
    return function nothingToStop() {};
  }

  let handle: PluginListenerHandle | null = null;
  let stopped = false;

  async function attach(): Promise<void> {
    try {
      const attached = await ShareInbox.addListener('share', function onShareEvent(raw) {
        const share = asSharedText(raw);
        if (share === null) {
          log.warn('share.malformed', {});
          return;
        }
        log.info('share.received', { has_subject: share.subject !== undefined });
        onShare(share);
      });
      if (stopped) await attached.remove();
      else handle = attached;
    } catch (cause) {
      log.error('share.listen_failed', {
        reason: cause instanceof Error ? cause.message : 'unknown',
      });
    }
  }
  void attach();

  return function stopListening() {
    stopped = true;
    if (handle !== null) void detach(handle);
  };
}

/** Cleanup cannot await, so this owns its own failure (CODESTYLE §8). */
async function detach(handle: PluginListenerHandle): Promise<void> {
  try {
    await handle.remove();
  } catch (cause) {
    log.warn('share.detach_failed', { reason: cause instanceof Error ? cause.message : 'unknown' });
  }
}
