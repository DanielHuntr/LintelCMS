import { apiRequest } from "../api/client.js";
import type { Collection } from "../content/content.types.js";
import type { EntryPreview, PreviewedEntry } from "./preview.types.js";

/** Calls to the live preview routes. One function per route. */

export function createEntryPreview(entryId: string): Promise<EntryPreview> {
  return apiRequest<EntryPreview>(`/entries/${entryId}/preview`, { method: "POST" });
}

export function fetchPreviewedEntry(token: string): Promise<PreviewedEntry> {
  return apiRequest<PreviewedEntry>(`/preview?token=${encodeURIComponent(token)}`);
}

/** Connects a collection to its website's preview page, or disconnects it with null. */
export function savePreviewUrlPattern(
  collectionHandle: string,
  previewUrlPattern: string | null,
): Promise<Collection> {
  return apiRequest<Collection>(`/collections/${encodeURIComponent(collectionHandle)}`, {
    method: "PUT",
    body: { previewUrlPattern },
  });
}
