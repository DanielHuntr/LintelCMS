import { useBlocker } from "@tanstack/react-router";

/**
 * Asks before leaving a screen with unsaved changes: our own dialog for links inside the
 * admin, and the browser's for closing the tab or reloading (the only thing browsers allow).
 * Returns what the dialog needs: whether to show it, and the two answers.
 */
export function useLeaveWarning(hasUnsavedChanges: boolean) {
  const blocker = useBlocker({
    // Opening the preview or the items list changes only the address's query, on the same
    // screen, so it isn't leaving (LINTEL-FUNC-024).
    shouldBlockFn: ({ current, next }) => hasUnsavedChanges && current.pathname !== next.pathname,
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  });

  return {
    isAsking: blocker.status === "blocked",
    stay: () => blocker.reset?.(),
    leave: () => blocker.proceed?.(),
  };
}
