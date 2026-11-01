import type { PageDocument } from "@lintel/builder-model";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
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
export function usePageDesignSaving(entry: Entry, fieldHandle: string) {
  const queryClient = useQueryClient();
  const [design, setDesign] = useState<PageDocument | null>(null);
  const [saved, setSaved] = useState<PageDocument | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestEntry, setLatestEntry] = useState(entry);
  const [isPublishing, setIsPublishing] = useState(false);
  const entryRef = useRef(entry);

  const hasUnsavedChanges = design !== null && design !== saved;

  const save = useCallback(
    async (next: PageDocument | null) => {
      if (!next) return;
      setStatus("saving");
      try {
        const current = entryRef.current;
        const updated = await updateEntry(current.id, {
          data: { [fieldHandle]: next },
          slug: current.slug,
          parentId: current.parentId,
        });
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

  const { saveNow } = useAutosave({ draft: design, hasUnsavedChanges, isEnabled: true, save });

  const publish = useCallback(async () => {
    setIsPublishing(true);
    try {
      await saveNow();
      const published = await publishEntry(entryRef.current.id);
      entryRef.current = published;
      setLatestEntry(published);
      queryClient.setQueryData(contentKeys.entry(published.id), published);
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
    } catch (error) {
      setStatus("failed");
      setErrorMessage(describeError(error));
    } finally {
      setIsPublishing(false);
    }
  }, [saveNow, queryClient]);

  return {
    entry: latestEntry,
    change: setDesign,
    status,
    errorMessage,
    hasUnsavedChanges,
    saveNow: () => saveNow().catch(() => undefined),
    publish,
    isPublishing,
  };
}

/** The API's message for the page field, when it refused the design. */
function fieldMessage(error: unknown, fieldHandle: string): string | undefined {
  if (typeof error !== "object" || error === null || !("fields" in error)) return undefined;
  const fields = (error as { fields?: Readonly<Record<string, string>> }).fields;
  return fields?.[fieldHandle];
}
