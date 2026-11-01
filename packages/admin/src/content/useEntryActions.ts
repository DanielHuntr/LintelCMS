import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type Dispatch } from "react";
import { describeError } from "../api/describeError.js";
import {
  createEntry,
  deleteEntry,
  publishEntry,
  restoreRevision,
  scheduleEntry,
  unpublishEntry,
  updateEntry,
} from "./content.api.js";
import { contentKeys } from "./content.queries.js";
import type { Entry } from "./content.types.js";
import type { EntryDraft, EntryDraftAction } from "./entryDraft.js";
import { fieldErrorsFrom } from "./fieldErrors.js";

interface EntryActionsOptions {
  collectionHandle: string;
  initialEntry: Entry | undefined;
  dispatch: Dispatch<EntryDraftAction>;
  /** Called once, when a new entry is first saved and gets an id. */
  onCreated: (entry: Entry) => void;
}

/**
 * Everything the editor can ask the API to do with an entry. Each action keeps the latest
 * entry from the API (status, "unpublished changes"), refreshes the lists that show it, and
 * turns a failure into a message. Saving rethrows, so callers can move focus to the problem.
 */
export function useEntryActions({
  collectionHandle,
  initialEntry,
  dispatch,
  onCreated,
}: EntryActionsOptions) {
  const queryClient = useQueryClient();
  const [entry, setEntry] = useState(initialEntry);
  const [isWorking, setIsWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Read straight after a save in the same click (save, then publish), before React re-renders.
  const entryId = useRef(initialEntry?.id);

  function remember(updated: Entry) {
    entryId.current = updated.id;
    setEntry(updated);
    queryClient.setQueryData(contentKeys.entry(updated.id), updated);
    void queryClient.invalidateQueries({ queryKey: contentKeys.collections() });
    void queryClient.invalidateQueries({ queryKey: contentKeys.revisions(updated.id) });
  }

  async function save(draft: EntryDraft): Promise<Entry> {
    dispatch({ type: "saveStarted" });
    try {
      const isNew = entryId.current === undefined;
      const saved = entryId.current
        ? await updateEntry(entryId.current, draft)
        : await createEntry(collectionHandle, draft);
      dispatch({ type: "saveSucceeded", sent: draft, entry: saved });
      remember(saved);
      if (isNew) onCreated(saved);
      return saved;
    } catch (error) {
      dispatch({
        type: "saveFailed",
        fieldErrors: fieldErrorsFrom(error),
        message: describeError(error),
      });
      throw error;
    }
  }

  /** Runs a publishing action on the saved entry, showing any failure in the banner. */
  async function run(action: (id: string) => Promise<Entry | void>): Promise<boolean> {
    const id = entryId.current;
    if (!id) return false;
    setIsWorking(true);
    setActionError(null);
    try {
      const updated = await action(id);
      if (updated) remember(updated);
      return true;
    } catch (error) {
      setActionError(describeError(error));
      return false;
    } finally {
      setIsWorking(false);
    }
  }

  return {
    entry,
    isWorking,
    actionError,
    dismissActionError: () => setActionError(null),
    save,
    publish: () => run(publishEntry),
    unpublish: () => run(unpublishEntry),
    schedule: (publishAt: string) => run((id) => scheduleEntry(id, publishAt)),
    restore: (revisionId: string) =>
      run(async (id) => {
        const restored = await restoreRevision(id, revisionId);
        dispatch({ type: "entryReplaced", entry: restored });
        return restored;
      }),
    remove: () =>
      run(async (id) => {
        await deleteEntry(id);
        queryClient.removeQueries({ queryKey: contentKeys.entry(id) });
        await queryClient.invalidateQueries({ queryKey: contentKeys.collections() });
      }),
  };
}
