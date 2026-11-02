import { useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState, type Dispatch } from "react";
import { describeError } from "../api/describeError.js";
import { t } from "../i18n/strings.js";
import {
  createEntry,
  deleteEntry,
  duplicateEntry,
  publishEntry,
  restoreRevision,
  scheduleEntry,
  unpublishEntry,
  updateEntry,
} from "./content.api.js";
import { contentKeys } from "./content.queries.js";
import type { Entry } from "./content.types.js";
import { changesSince, type EntryDraft, type EntryDraftAction } from "./entryDraft.js";
import { fieldErrorsFrom } from "./fieldErrors.js";

interface EntryActionsOptions {
  collectionHandle: string;
  initialEntry: Entry | undefined;
  dispatch: Dispatch<EntryDraftAction>;
  /** Called once, when a new entry is first saved and gets an id. */
  onCreated: (entry: Entry) => void;
  /** The language a new entry is written in. Undefined is the site's main language. */
  locale?: string;
  /** Called when publishing or scheduling is refused because fields need filling in. */
  onPublishBlocked?: (error: unknown) => void;
  /** What the editor last saved, so a save sends only what changed since (`changesSince`). */
  saved: EntryDraft;
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
  locale,
  onPublishBlocked,
  saved,
}: EntryActionsOptions) {
  // Read when a save starts, which can be after the render that set it.
  const savedDraft = useRef(saved);
  useLayoutEffect(() => {
    savedDraft.current = saved;
  }, [saved]);
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

  async function save(
    draft: EntryDraft,
    { saveVersion }: { saveVersion: boolean } = { saveVersion: false },
  ): Promise<Entry> {
    dispatch({ type: "saveStarted" });
    try {
      const isNew = entryId.current === undefined;
      const saved = entryId.current
        ? await updateEntry(entryId.current, changesSince(savedDraft.current, draft), saveVersion)
        : await createEntry(collectionHandle, draft, locale);
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
      const fieldErrors = fieldErrorsFrom(error);
      if (Object.keys(fieldErrors).length > 0) {
        // Drafts may leave required fields empty; publishing asks for them, field by field.
        dispatch({ type: "publishBlocked", fieldErrors });
        setActionError(t("editor.fillRequiredToPublish"));
        onPublishBlocked?.(error);
      } else {
        setActionError(describeError(error));
      }
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
    /** The copy, or undefined when duplicating failed (the banner says why). */
    duplicate: async (): Promise<Entry | undefined> => {
      let copy: Entry | undefined;
      await run(async (id) => {
        copy = await duplicateEntry(id);
        await queryClient.invalidateQueries({ queryKey: contentKeys.collections() });
      });
      return copy;
    },
    remove: () =>
      run(async (id) => {
        await deleteEntry(id);
        queryClient.removeQueries({ queryKey: contentKeys.entry(id) });
        await queryClient.invalidateQueries({ queryKey: contentKeys.collections() });
      }),
  };
}
