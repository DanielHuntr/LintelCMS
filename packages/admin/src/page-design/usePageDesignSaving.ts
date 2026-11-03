import type { PageDocument } from "@lintel/builder-model";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { describeError } from "../api/describeError.js";
import { publishEntry, updateEntry } from "../content/content.api.js";
import { contentKeys } from "../content/content.queries.js";
import type { Entry } from "../content/content.types.js";
import type { SaveStatus } from "../content/entryDraft.js";
import { useAutosave } from "../content/useAutosave.js";

/**
 * Saves a page design like the entry editor saves an entry: shortly after changes stop, one
 * save at a time, through the entries API (so drafts, revisions and publishing work as they
 * always do). The entry in the query cache is kept up to date, so going back to the entry
 * editor shows the latest design.
 */
export function usePageDesignSaving(
  entry: Entry,
  fieldHandle: string,
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
  const entryRef = useRef(entry);

  useEffect(() => {
    if (!justPublished) return;
    const timer = window.setTimeout(() => setJustPublished(false), PUBLISHED_NOTE_MS);
    return () => window.clearTimeout(timer);
  }, [justPublished]);

  const hasUnsavedChanges = design !== null && design !== saved;

  const save = useCallback(
    async (next: PageDocument | null) => {
      if (!next) return;
      setStatus("saving");
      try {
        const current = entryRef.current;
        // Only the design is sent; the rest of the entry is the entry editor's.
        const updated = await updateEntry(current.id, { data: { [fieldHandle]: next } });
        entryRef.current = updated;
        setLatestEntry(updated);
        setSaved(next);
        setStatus("saved");
        setErrorMessage(null);
        queryClient.setQueryData(contentKeys.entry(updated.id), updated);
      } catch (error) {
        setStatus("failed");
        setErrorMessage(fieldMessage(error, fieldHandle) ?? describeError(error));
        throw error;
      }
    },
    [fieldHandle, queryClient],
  );

  const { saveNow, saveUntilSaved } = useAutosave({
    draft: design,
    hasUnsavedChanges,
    isEnabled: true,
    save,
  });

  const publish = useCallback(async () => {
    setIsPublishing(true);
    try {
      await saveNow();
      const published = await publishEntry(entryRef.current.id);
      await publishShared?.();
      entryRef.current = published;
      setLatestEntry(published);
      queryClient.setQueryData(contentKeys.entry(published.id), published);
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
      setJustPublished(true);
    } catch (error) {
      setStatus("failed");
      setErrorMessage(describeError(error));
    } finally {
      setIsPublishing(false);
    }
  }, [saveNow, queryClient, publishShared]);

  return {
    entry: latestEntry,
    change: setDesign,
    status,
    errorMessage,
    hasUnsavedChanges,
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
