import { apiRequest, apiUrl } from "../api/client.js";

/** Calls to the API's content model routes (packages/core/src/content-model-sync). */

export interface PendingModelChange {
  summary: string;
  /** What would be deleted, in a sentence. */
  impact: string | null;
  destructive: boolean;
}

export interface ModelSyncNotice {
  id: string;
  message: string;
  createdAt: string;
}

export interface ContentModelStatus {
  /** The site has a content model folder, so its files are the source of truth. */
  managedInCode: boolean;
  /** Content types and the rest can be changed here. */
  editableInAdmin: boolean;
  folder: string;
  mode: "development" | "production";
  pending: PendingModelChange[];
  notices: ModelSyncNotice[];
  problems: string[];
}

export function getContentModelStatus(): Promise<ContentModelStatus> {
  return apiRequest<ContentModelStatus>("/content-model/status");
}

export function applyPendingModelChanges(): Promise<ContentModelStatus> {
  return apiRequest<ContentModelStatus>("/content-model/pending/apply", { method: "POST" });
}

export function dismissModelNotice(noticeId: string): Promise<void> {
  return apiRequest<void>(`/content-model/notices/${encodeURIComponent(noticeId)}`, {
    method: "DELETE",
  });
}

/** Where the API announces content model changes, as server-sent events. */
export const contentModelEventsUrl = `${apiUrl}/content-model/events`;
