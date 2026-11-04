import { useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState, type Dispatch } from "react";
import { describeError } from "../api/describeError.js";
import { t } from "../i18n/strings.js";
import { ApiError } from "../api/client.js";
import {
  createEntry,
  duplicateEntry,
  getEntry,
  keepVersion,
  publishEntry,
  restoreRevision,
  scheduleEntry,
  unpublishEntry,
  updateEntry,
} from "./content.api.js";
import { contentKeys } from "./content.queries.js";
import type { Entry } from "./content.types.js";
import {
  changesSince,
  draftFromEntry,
  type EntryDraft,
  type EntryDraftAction,
  findDraftClashes,
  rebaseDraft,
} from "./entryDraft.js";
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

/** Someone else saved this entry, and changed something this person changed too. */
export interface EntryConflict {
  latest: Entry;
  /** The fields both changed, by handle; "slug" and "parentId" for the address and the place. */
  handles: readonly string[];
}

/** A save that stopped to ask the person, which the save indicator shouldn't report as broken. */
export class EntryConflictError extends Error {}

const MOST_REBASES = 3;

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
  // The version the next save starts from.
  const version = useRef(initialEntry?.version);
  const [conflict, setConflict] = useState<EntryConflict | null>(null);

  function remember(updated: Entry) {
    entryId.current = updated.id;
    version.current = updated.version;
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
      const { saved, sent } = entryId.current
        ? await saveOverLatest(entryId.current, draft, saveVersion)
        : { saved: await createEntry(collectionHandle, draft, locale), sent: draft };
      dispatch({ type: "saveSucceeded", sent, entry: saved });
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

  /**
   * Saves, starting from the version this person last saw. If someone else saved meanwhile
   * their changes come in, and when nothing clashes this save just goes again on top of them.
   * When something does, it stops and asks (`conflict`), and nothing is sent.
   */
  async function saveOverLatest(
    id: string,
    draft: EntryDraft,
    saveVersion: boolean,
    rebases = 0,
  ): Promise<{ saved: Entry; sent: EntryDraft }> {
    try {
      const changes = changesSince(savedDraft.current, draft);
      return { saved: await updateEntry(id, changes, saveVersion, version.current), sent: draft };
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "ENTRY_CHANGED") throw error;
      if (rebases >= MOST_REBASES) throw error;
      const latest = await getEntry(id);
      const handles = findDraftClashes(savedDraft.current, draft, latest);
      if (handles.length > 0) {
        setConflict({ latest, handles });
        throw new EntryConflictError(error.message);
      }
      const rebased = rebaseDraft(savedDraft.current, draft, latest);
      adopt(latest);
      return saveOverLatest(id, rebased, saveVersion, rebases + 1);
    }
  }

  /** Takes someone else's save as what this person's changes are measured from. */
  function adopt(latest: Entry, useTheirs?: readonly string[], redraw = false) {
    savedDraft.current = draftFromEntry(latest);
    dispatch({ type: "rebased", entry: latest, useTheirs, redraw });
    version.current = latest.version;
    setEntry(latest);
    queryClient.setQueryData(contentKeys.entry(latest.id), latest);
  }

  /** Keeps this person's changes where both changed something; autosave then sends them. */
  function keepMine() {
    if (conflict) adopt(conflict.latest);
    setConflict(null);
  }

  /** Takes the other person's where both changed something, and sets this person's aside. */
  async function useTheirs(current: EntryDraft) {
    if (!conflict) return;
    const { latest, handles } = conflict;
    const mine = changesSince(savedDraft.current, current);
    await keepVersion(latest.id, { ...latest.data, ...mine.data });
    adopt(latest, handles, true);
    setConflict(null);
    void queryClient.invalidateQueries({ queryKey: contentKeys.revisions(latest.id) });
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
    conflict,
    keepMine,
    useTheirs,
    /** Closes the question for now; the next save asks again. */
    putOffConflict: () => setConflict(null),
    /** Someone else's save arrived, with nothing to ask about yet. */
    adopt,
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
    /** Deletes by `recycle` (to the recycle bin, offering Undo); false when that failed. */
    remove: (recycle: (id: string) => Promise<void>) =>
      run(async (id) => {
        await recycle(id);
        queryClient.removeQueries({ queryKey: contentKeys.entry(id) });
      }),
  };
}
