import { apiRequest } from "../api/client.js";

/** One entry due to be published (see `GET /entries/scheduled` in packages/core/src/entries). */
export interface ScheduledEntry {
  id: string;
  title: string;
  locale: string;
  collectionHandle: string;
  collectionName: string;
  scheduledFor: string;
  /** Only "publish": Lintel schedules publishing, not unpublishing. */
  action: "publish";
}

export function listScheduledEntries(range: { from: Date; to: Date }) {
  const query = new URLSearchParams({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  });
  return apiRequest<{ entries: ScheduledEntry[] }>(`/entries/scheduled?${query}`);
}
