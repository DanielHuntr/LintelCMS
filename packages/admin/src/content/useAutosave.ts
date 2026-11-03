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
  // What the last save sent. A save that just finished may not have been drawn yet, so
  // `hasUnsavedChanges` can lag behind; this stops the same draft going twice.
  const lastSaved = useRef<{ draft: Draft } | null>(null);
  // Counting finished saves lets the timer start again when edits arrived during a save.
  const [completedSaves, setCompletedSaves] = useState(0);

  useEffect(() => {
    latest.current = { draft, hasUnsavedChanges, isEnabled, save };
  });

  const isSaved = useCallback(() => {
    const { draft: newest, hasUnsavedChanges: isUnsaved } = latest.current;
    return !isUnsaved || lastSaved.current?.draft === newest;
  }, []);

  const saveNow = useCallback(
    async ({
      force = false,
      saveVersion = false,
    }: { force?: boolean; saveVersion?: boolean } = {}) => {
      while (saveInFlight.current) {
        await saveInFlight.current.catch(() => undefined);
      }
      const { draft: newest, save: send } = latest.current;
      if (isSaved() && !force) return;

      const request = send(newest, { saveVersion });
      saveInFlight.current = request;
      try {
        await request;
        lastSaved.current = { draft: newest };
        setCompletedSaves((count) => count + 1);
      } finally {
        saveInFlight.current = null;
      }
    },
    [isSaved],
  );

  /**
   * For leaving: saves until nothing is waiting, including an edit made while a save ran.
   * Rejects if a save fails, so the caller knows to stay.
   */
  const saveUntilSaved = useCallback(async () => {
    do {
      await saveNow();
      // Lets an edit made during the save reach `latest` before checking.
      await new Promise((resolve) => setTimeout(resolve));
    } while (!isSaved());
  }, [saveNow, isSaved]);

  useEffect(() => {
    if (!hasUnsavedChanges || !isEnabled) return;
    const timer = setTimeout(() => {
      // Failures are shown by the editor's save indicator; nothing more to do here.
      saveNow().catch(() => undefined);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [draft, hasUnsavedChanges, isEnabled, delayMs, saveNow, completedSaves]);

  return { saveNow, saveUntilSaved };
}
