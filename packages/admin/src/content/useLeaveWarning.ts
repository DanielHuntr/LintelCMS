import { useBlocker } from "@tanstack/react-router";

/**
 * Asks before leaving a screen with unsaved changes: our own dialog for links inside the
 * admin, and the browser's for closing the tab or reloading (the only thing browsers allow).
 * Returns what the dialog needs: whether to show it, and the two answers.
 */
export function useLeaveWarning(hasUnsavedChanges: boolean) {
  const blocker = useBlocker({
    shouldBlockFn: () => hasUnsavedChanges,
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  });

  return {
    isAsking: blocker.status === "blocked",
    stay: () => blocker.reset?.(),
    leave: () => blocker.proceed?.(),
  };
}
