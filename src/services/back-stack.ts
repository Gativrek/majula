/**
 * The back button (SPECS §2.2, Back): each step that back should undo — an open recipe, an
 * edit in progress, the Deleted or Backup section — pushes one entry here, and back pops
 * the newest one and runs its handler.
 *
 * On the device, `MainActivity` turns the hardware button into `WebView.goBack()` while
 * there is history to go back through, which the page sees as `popstate`. Each step
 * pushes a History API entry so there is. When the stack is empty there is no entry
 * either, the WebView cannot go back, and Android leaves the app — back on the list does
 * what back on any list does.
 *
 * The one subtle part is a step closed by an on-screen button instead. Its history entry
 * is still there, and left alone the next back press would consume it by closing
 * nothing. So a dismissal also steps history back once, and the `popstate` that step
 * causes is recognised as self-inflicted and skipped.
 */

import { log } from '../lib/logger.ts';

/** The slice of `window.history` the stack uses, so tests can supply their own. */
export interface HistoryLike {
  pushState(data: unknown, unused: string): void;
  back(): void;
}

export interface BackStack {
  /**
   * Register what back should do for the step now open.
   *
   * @returns a dismissal for when the step closes some other way. Calling it after back
   * already closed the step is harmless.
   */
  push(onBack: () => void): () => void;
  /** Steps currently open, for tests and diagnostics. */
  depth(): number;
}

interface Entry {
  onBack: () => void;
}

/**
 * @param history where entries are pushed and stepped back through.
 * @param listen subscribes the stack to back presses (`popstate` on the device).
 */
export function createBackStack(
  history: HistoryLike,
  listen: (onPop: () => void) => void,
): BackStack {
  const entries: Entry[] = [];
  let selfInflictedPops = 0;

  listen(function onPop() {
    if (selfInflictedPops > 0) {
      selfInflictedPops -= 1;
      return;
    }
    const entry = entries.pop();
    if (entry === undefined) {
      log.debug('back.empty_stack', {});
      return;
    }
    log.debug('back.pressed', { depth: entries.length });
    entry.onBack();
  });

  return {
    push(onBack) {
      const entry: Entry = { onBack };
      entries.push(entry);
      history.pushState({ majulaBackDepth: entries.length }, '');

      return function dismiss() {
        const index = entries.lastIndexOf(entry);
        // Already popped by a back press: its history entry is spent too.
        if (index === -1) return;
        entries.splice(index, 1);
        selfInflictedPops += 1;
        history.back();
      };
    },

    depth() {
      return entries.length;
    },
  };
}

let appBackStack: BackStack | null = null;

/** The app's one back stack, bound to the real window. */
export function backStack(): BackStack {
  if (appBackStack === null) {
    appBackStack = createBackStack(window.history, function listenForPop(onPop) {
      window.addEventListener('popstate', onPop);
    });
  }
  return appBackStack;
}
