import { useEffect, useRef } from 'react';
import { backStack } from '../services/back-stack.ts';

/**
 * While `active`, the back button runs `onBack` instead of leaving the app
 * (SPECS §2.2, Back).
 *
 * `onBack` is read through a ref so the step is registered once per activation, not once
 * per render: re-registering on every render would push a history entry each time and
 * leave back needing several presses to do one thing.
 */
export function useBackStep(active: boolean, onBack: () => void): void {
  const latest = useRef(onBack);
  latest.current = onBack;

  useEffect(
    function registerBackStep() {
      if (!active) return undefined;
      return backStack().push(function runLatestHandler() {
        latest.current();
      });
    },
    [active],
  );
}
