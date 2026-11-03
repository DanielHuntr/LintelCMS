import { apiRequest } from "../api/client.js";

/** Calls to the API's content-only editing routes (see packages/core/src/client-editing). */

export type ClientChangesRule = "goLive" | "needsApproval";

export interface ClientReview {
  id: string;
  entryId: string;
  status: "waiting" | "approved" | "sentBack";
  requestedByName: string | null;
  requestNote: string;
  requestedAt: string;
  decidedByName: string | null;
  decisionNote: string;
  decidedAt: string | null;
}

export interface ClientReviewListItem extends ClientReview {
  entry: { id: string; title: string; collection: string; collectionName: string };
}

export interface EntryReviewState {
  needsApproval: boolean;
  /** This person sends their changes for review instead of publishing them. */
  mustSendForReview: boolean;
  review: ClientReview | null;
}

export function getClientEditingSettings() {
  return apiRequest<{ clientChanges: ClientChangesRule }>("/client-editing/settings");
}

export function updateClientEditingSettings(clientChanges: ClientChangesRule) {
  return apiRequest<{ clientChanges: ClientChangesRule }>("/client-editing/settings", {
    method: "PATCH",
    body: { clientChanges },
  });
}

export function getEntryReviewState(entryId: string) {
  return apiRequest<EntryReviewState>(`/entries/${entryId}/review`);
}

export function sendForReview(entryId: string, note: string) {
  return apiRequest<EntryReviewState>(`/entries/${entryId}/review`, {
    method: "POST",
    body: { note },
  });
}

export async function listWaitingReviews(): Promise<ClientReviewListItem[]> {
  return (await apiRequest<{ reviews: ClientReviewListItem[] }>("/client-reviews")).reviews;
}

export function approveReview(reviewId: string) {
  return apiRequest<ClientReview>(`/client-reviews/${reviewId}/approve`, { method: "POST" });
}

export function sendBackReview(reviewId: string, note: string) {
  return apiRequest<ClientReview>(`/client-reviews/${reviewId}/send-back`, {
    method: "POST",
    body: { note },
  });
}
