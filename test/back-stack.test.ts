import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setLogLevel } from '../src/lib/logger.ts';
import { createBackStack } from '../src/services/back-stack.ts';

setLogLevel('error');

/**
 * A model of the WebView's session history and of `MainActivity`'s back handling.
 *
 * `history.back()` is asynchronous in a real browser — the traversal and its `popstate`
 * happen after the current task — and the model keeps that, because the interleaving of
 * a queued `back()` with a synchronous `pushState()` is exactly where this goes wrong.
 */
function device() {
  const entries: unknown[] = ['root'];
  let index = 0;
  let onPop: () => void = () => {};
  let leftApp = 0;

  const history = {
    pushState(data: unknown) {
      entries.splice(index + 1);
      entries.push(data);
      index = entries.length - 1;
    },
    back() {
      setTimeout(function traverse() {
        if (index === 0) return;
        index -= 1;
        onPop();
      }, 0);
    },
  };

  return {
    history,
    listen(handler: () => void) {
      onPop = handler;
    },
    /** MainActivity: go back through the WebView's history if it can, else leave. */
    async pressBack() {
      if (index > 0) history.back();
      else leftApp += 1;
      await settle();
    },
    leftApp: () => leftApp,
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

function recorder() {
  const calls: string[] = [];
  return { calls, handler: (name: string) => () => calls.push(name) };
}

describe('back stack', function backSuite() {
  it('runs the open step on back', async function closesStep() {
    const phone = device();
    const stack = createBackStack(phone.history, phone.listen);
    const { calls, handler } = recorder();

    stack.push(handler('recipe'));
    await phone.pressBack();

    assert.deepEqual(calls, ['recipe']);
    assert.equal(stack.depth(), 0);
    assert.equal(phone.leftApp(), 0, 'back closed the recipe; it did not leave the app');
  });

  it('leaves the app from the list, where nothing is open', async function atRoot() {
    const phone = device();
    createBackStack(phone.history, phone.listen);
    await phone.pressBack();
    assert.equal(phone.leftApp(), 1);
  });

  it('undoes one step at a time, newest first', async function nested() {
    const phone = device();
    const stack = createBackStack(phone.history, phone.listen);
    const { calls, handler } = recorder();

    stack.push(handler('backup'));
    stack.push(handler('editor'));

    await phone.pressBack();
    assert.deepEqual(calls, ['editor']);
    await phone.pressBack();
    assert.deepEqual(calls, ['editor', 'backup']);
    await phone.pressBack();
    assert.equal(phone.leftApp(), 1, 'only once everything is closed does back leave');
  });

  it('spends the history entry of a step closed on screen', async function dismissed() {
    const phone = device();
    const stack = createBackStack(phone.history, phone.listen);
    const { calls, handler } = recorder();

    const dismiss = stack.push(handler('recipe'));
    dismiss(); // the Close button
    await settle();

    await phone.pressBack();
    assert.deepEqual(calls, [], 'the closed recipe must not be closed a second time');
    assert.equal(
      phone.leftApp(),
      1,
      'with nothing open, back leaves — it is not eaten by a stale entry',
    );
  });

  it('survives closing one step and opening the next in the same moment', async function swap() {
    // Saving a recipe closes the editor and opens kitchen mode in one render. The
    // editor's queued history.back() races the view's pushState().
    const phone = device();
    const stack = createBackStack(phone.history, phone.listen);
    const { calls, handler } = recorder();

    const dismissEditor = stack.push(handler('editor'));
    dismissEditor();
    stack.push(handler('view'));
    await settle();

    await phone.pressBack();
    assert.deepEqual(calls, ['view'], 'back closes the view, and the editor stays closed');
    await phone.pressBack();
    assert.equal(phone.leftApp(), 1);
  });

  it('ignores a dismissal after back already closed the step', async function lateDismiss() {
    const phone = device();
    const stack = createBackStack(phone.history, phone.listen);
    const { handler } = recorder();

    const dismiss = stack.push(handler('recipe'));
    await phone.pressBack();
    dismiss(); // the component's cleanup, running after back closed it
    await settle();

    await phone.pressBack();
    assert.equal(phone.leftApp(), 1, 'a late dismissal must not step history back again');
  });

  it('keeps count when an older step is closed before a newer one', async function outOfOrder() {
    const phone = device();
    const stack = createBackStack(phone.history, phone.listen);
    const { calls, handler } = recorder();

    const dismissBackup = stack.push(handler('backup'));
    stack.push(handler('dialog'));
    dismissBackup();
    await settle();

    await phone.pressBack();
    assert.deepEqual(calls, ['dialog']);
    await phone.pressBack();
    assert.equal(phone.leftApp(), 1);
  });
});
