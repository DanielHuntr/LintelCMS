import { useCallback, useEffect, useRef, useState } from "react";

interface AutosaveOptions<Draft> {
  /** What is on screen now. A new value restarts the quiet-period timer. */
  draft: Draft;
  hasUnsavedChanges: boolean;
  /** False while saving isn't possible yet, e.g. a new entry with no title. */
  isEnabled: boolean;
  /**
   * Sends the draft to the API. Rejects when the save fails. `saveVersion` is true for a
   * save someone asked for (Cmd/Ctrl+S), which keeps a revision of its own.
   */
  save: (draft: Draft, options: { saveVersion: boolean }) => Promise<unknown>;
  /** How long typing must pause before saving. */
  delayMs?: number;
}

export const autosaveDelayMs = 1500;

/**
 * Saves a draft shortly after typing stops, like Notes or Pages. Only one save runs at a time:
 * a save asked for during another waits for it, then sends whatever is newest. A failed save
 * isn't retried on a loop; the next edit (or Cmd/Ctrl+S) tries again.
 */
export function useAutosave<Draft>({
  draft,
  hasUnsavedChanges,
  isEnabled,
  save,
  delayMs = autosaveDelayMs,
}: AutosaveOptions<Draft>) {
  const latest = useRef({ draft, hasUnsavedChanges, isEnabled, save });
  const saveInFlight = useRef<Promise<unknown> | null>(null);
  // Counting finished saves lets the timer start again when edits arrived during a save.
  const [completedSaves, setCompletedSaves] = useState(0);

  useEffect(() => {
    latest.current = { draft, hasUnsavedChanges, isEnabled, save };
  });

  const saveNow = useCallback(
    async ({
      force = false,
      saveVersion = false,
    }: { force?: boolean; saveVersion?: boolean } = {}) => {
      while (saveInFlight.current) {
        await saveInFlight.current.catch(() => undefined);
      }
      const { draft: newest, hasUnsavedChanges: isUnsaved, save: send } = latest.current;
      if (!isUnsaved && !force) return;

      const request = send(newest, { saveVersion });
      saveInFlight.current = request;
      try {
        await request;
        setCompletedSaves((count) => count + 1);
      } finally {
        saveInFlight.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!hasUnsavedChanges || !isEnabled) return;
    const timer = setTimeout(() => {
      // Failures are shown by the editor's save indicator; nothing more to do here.
      saveNow().catch(() => undefined);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [draft, hasUnsavedChanges, isEnabled, delayMs, saveNow, completedSaves]);

  return { saveNow };
}
