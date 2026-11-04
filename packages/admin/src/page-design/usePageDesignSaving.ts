import {
  applyPageChanges,
  createEmptyPage,
  diffPages,
  findClashes,
  type PageClash,
  type PageDocument,
  type RemoteUpdate,
  standardCatalogue,
  validatePageDocument,
} from "@lintel/builder-model";
import type { IncomingChanges } from "@lintel/builder";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { getEntry, keepVersion, publishEntry, updateEntry } from "../content/content.api.js";
import { contentKeys } from "../content/content.queries.js";
import type { Entry } from "../content/content.types.js";
import type { SaveStatus } from "../content/entryDraft.js";
import { useAutosave } from "../content/useAutosave.js";
import { t } from "../i18n/strings.js";

/** Someone else saved the page, and changed something this person changed too. */
export interface DesignConflict {
  latest: Entry;
  /** The design both started from. */
  base: PageDocument;
  theirs: PageDocument;
  clashes: readonly PageClash[];
}

const MOST_MERGES = 3;

/**
 * Saves a page design like the entry editor saves an entry: shortly after changes stop, one
 * save at a time, through the entries API (so drafts, revisions and publishing work as they
 * always do). The entry in the query cache is kept up to date, so going back to the entry
 * editor shows the latest design.
 *
 * Each save says which version it started from. If someone else saved meanwhile, their changes
 * are merged with this person's and the save goes again; only when both changed the same thing
 * does it stop and ask (`conflict`).
 */
export function usePageDesignSaving(
  entry: Entry,
  fieldHandle: string,
  /** The design as opened: what this person's changes are measured from. */
  openedDesign: PageDocument | null,
  /** Also put live with the page: the site's navigation and footer changes. */
  publishShared?: () => Promise<void>,
) {
  const queryClient = useQueryClient();
  const [design, setDesign] = useState<PageDocument | null>(null);
  const [saved, setSaved] = useState<PageDocument | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestEntry, setLatestEntry] = useState(entry);
  const [isPublishing, setIsPublishing] = useState(false);
  // True for a few seconds after Publish worked, so the button can say so.
  const [justPublished, setJustPublished] = useState(false);
  const [conflict, setConflict] = useState<DesignConflict | null>(null);
  const [mergeNote, setMergeNote] = useState<string | null>(null);
  const entryRef = useRef(entry);
  const savedDesign = useRef(openedDesign);
  const newestDesign = useRef<PageDocument | null>(null);
  const listeners = useRef(new Set<(update: RemoteUpdate) => void>());
  const incomingChanges = useMemo<IncomingChanges>(
    () => ({
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
    }),
    [],
  );

  useEffect(() => {
    if (!justPublished) return;
    const timer = window.setTimeout(() => setJustPublished(false), PUBLISHED_NOTE_MS);
    return () => window.clearTimeout(timer);
  }, [justPublished]);

  useEffect(() => {
    if (!mergeNote) return;
    const timer = window.setTimeout(() => setMergeNote(null), PUBLISHED_NOTE_MS);
    return () => window.clearTimeout(timer);
  }, [mergeNote]);

  const hasUnsavedChanges = design !== null && design !== saved;

  const remember = useCallback(
    (updated: Entry) => {
      entryRef.current = updated;
      setLatestEntry(updated);
      queryClient.setQueryData(contentKeys.entry(updated.id), updated);
    },
    [queryClient],
  );

  /** Puts someone else's changes on screen, and measures this person's from theirs. */
  const takeIn = useCallback(
    (
      latest: Entry,
      theirs: PageDocument,
      document: PageDocument,
      changes: RemoteUpdate["changes"],
    ) => {
      remember(latest);
      savedDesign.current = theirs;
      newestDesign.current = document;
      setDesign(document);
      for (const listener of listeners.current) listener({ document, changes });
    },
    [remember],
  );

  const saveMerged = useCallback(
    async (first: PageDocument): Promise<{ updated: Entry; sent: PageDocument }> => {
      let next = first;
      for (let merges = 0; ; merges += 1) {
        const { id, version } = entryRef.current;
        try {
          const updated = await updateEntry(id, { data: { [fieldHandle]: next } }, false, version);
          return { updated, sent: next };
        } catch (error) {
          if (!(error instanceof ApiError) || error.code !== "ENTRY_CHANGED") throw error;
          if (merges >= MOST_MERGES) throw error;
          const latest = await getEntry(id);
          const base = savedDesign.current ?? createEmptyPage();
          const theirs = designOf(latest, fieldHandle);
          const theirChanges = diffPages(base, theirs);
          const mine = diffPages(base, next);
          const clashes = findClashes(base, mine, theirChanges);
          if (clashes.length > 0) {
            setConflict({ latest, base, theirs, clashes });
            throw error;
          }
          next = applyPageChanges(theirs, mine);
          takeIn(latest, theirs, next, theirChanges);
          if (theirChanges.length > 0) {
            const name = latest.updatedBy?.name;
            setMergeNote(name ? t("collab.merged", { name }) : t("collab.mergedSomeone"));
          }
        }
      }
    },
    [fieldHandle, takeIn],
  );

  const save = useCallback(
    async (next: PageDocument | null) => {
      if (!next) return;
      setStatus("saving");
      try {
        // Only the design is sent; the rest of the entry is the entry editor's.
        const { updated, sent } = await saveMerged(next);
        remember(updated);
        savedDesign.current = sent;
        setSaved(sent);
        setStatus("saved");
        setErrorMessage(null);
      } catch (error) {
        setStatus("failed");
        setErrorMessage(fieldMessage(error, fieldHandle) ?? describeError(error));
        throw error;
      }
    },
    [fieldHandle, remember, saveMerged],
  );

  const { saveNow, saveUntilSaved } = useAutosave({
    draft: design,
    hasUnsavedChanges,
    isEnabled: conflict === null,
    save,
  });

  const publish = useCallback(async () => {
    setIsPublishing(true);
    try {
      await saveNow();
      const published = await publishEntry(entryRef.current.id);
      await publishShared?.();
      remember(published);
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
      setJustPublished(true);
    } catch (error) {
      setStatus("failed");
      setErrorMessage(describeError(error));
    } finally {
      setIsPublishing(false);
    }
  }, [saveNow, queryClient, publishShared, remember]);

  /** Where both changed something this person's stands; everything else of both is kept. */
  const keepMine = useCallback(() => {
    if (!conflict || !newestDesign.current) return;
    const { latest, base, theirs } = conflict;
    const mine = diffPages(base, newestDesign.current);
    takeIn(latest, theirs, applyPageChanges(theirs, mine), diffPages(base, theirs));
    setConflict(null);
  }, [conflict, takeIn]);

  /** Where both changed something theirs stands; this person's whole page goes into History. */
  const useTheirs = useCallback(async () => {
    if (!conflict || !newestDesign.current) return;
    const { latest, base, theirs } = conflict;
    await keepVersion(latest.id, { ...latest.data, [fieldHandle]: newestDesign.current });
    const theirChanges = diffPages(base, theirs);
    const merged = applyPageChanges(
      applyPageChanges(theirs, diffPages(base, newestDesign.current)),
      theirChanges,
    );
    takeIn(latest, theirs, merged, theirChanges);
    setConflict(null);
    void queryClient.invalidateQueries({ queryKey: contentKeys.revisions(latest.id) });
  }, [conflict, fieldHandle, queryClient, takeIn]);

  const change = useCallback((document: PageDocument) => {
    newestDesign.current = document;
    setDesign(document);
  }, []);

  return {
    entry: latestEntry,
    change,
    status,
    errorMessage,
    hasUnsavedChanges,
    incomingChanges,
    conflict,
    keepMine,
    useTheirs,
    /** Closes the question for now; the next save asks again. */
    putOffConflict: () => setConflict(null),
    /** Says someone's changes were merged with this person's. */
    mergeNote,
    saveNow: () => saveNow().catch(() => undefined),
    /** Saves anything waiting, and says whether it's all safe to leave. */
    saveBeforeLeaving: () =>
      saveUntilSaved().then(
        () => true,
        () => false,
      ),
    publish,
    isPublishing,
    justPublished,
    /** What the website shows lags behind what's saved: never published, or changed since. */
    liveness: describeLiveness(latestEntry, hasUnsavedChanges),
  };
}

/** The design stored on an entry; an empty page if there is none or it can't be read. */
function designOf(entry: Entry, fieldHandle: string): PageDocument {
  const stored = entry.data[fieldHandle];
  if (stored === null || stored === undefined) return createEmptyPage();
  const checked = validatePageDocument(stored, standardCatalogue);
  return checked.ok ? checked.document : createEmptyPage();
}

const PUBLISHED_NOTE_MS = 4000;

export type Liveness = "live" | "notLiveYet" | "changesNotLive";

function describeLiveness(entry: Entry, hasUnsavedChanges: boolean): Liveness {
  if (entry.status !== "published") return "notLiveYet";
  return entry.hasUnpublishedChanges || hasUnsavedChanges ? "changesNotLive" : "live";
}

/** The API's message for the page field, when it refused the design. */
function fieldMessage(error: unknown, fieldHandle: string): string | undefined {
  if (typeof error !== "object" || error === null || !("fields" in error)) return undefined;
  const fields = (error as { fields?: Readonly<Record<string, string>> }).fields;
  return fields?.[fieldHandle];
}
