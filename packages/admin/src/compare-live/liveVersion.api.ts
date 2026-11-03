import { apiRequest } from "../api/client.js";

/** What the website shows now (see `GET /entries/:id/live`); `data` is null if nothing is. */
export interface LiveVersion {
  publishedAt: string | null;
  data: Record<string, unknown> | null;
}

export function getLiveVersion(entryId: string) {
  return apiRequest<LiveVersion>(`/entries/${encodeURIComponent(entryId)}/live`);
}
