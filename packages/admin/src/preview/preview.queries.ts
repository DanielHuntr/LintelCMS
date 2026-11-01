import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createEntryPreview, fetchPreviewedEntry } from "./preview.api.js";

/** Tokens last 30 minutes; a fresh one is fetched well before the old one runs out. */
const tokenRefreshMs = 20 * 60 * 1000;

export const previewKeys = {
  token: (entryId: string) => ["entries", entryId, "preview"] as const,
  draft: (token: string, savedAt: string) => ["preview", token, savedAt] as const,
};

/** A preview token for the entry while the preview is open; nothing for an unsaved entry. */
export function usePreviewToken(entryId: string | undefined) {
  return useQuery({
    queryKey: previewKeys.token(entryId ?? "new"),
    queryFn: () => createEntryPreview(entryId ?? ""),
    enabled: entryId !== undefined,
    staleTime: tokenRefreshMs,
    refetchInterval: tokenRefreshMs,
    refetchOnWindowFocus: false,
  });
}

/**
 * The draft as the delivery API would serve it, for the built-in preview. `savedAt` (the
 * entry's last save) is part of the key, so every save shows up, while the previous version
 * stays on screen until the new one has arrived.
 */
export function usePreviewedDraft(token: string | undefined, savedAt: string) {
  return useQuery({
    queryKey: previewKeys.draft(token ?? "", savedAt),
    queryFn: () => fetchPreviewedEntry(token ?? ""),
    enabled: token !== undefined,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}
