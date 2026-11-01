import { apiRequest } from "../api/client.js";
import type {
  Catalogue,
  ContentApprovalSetting,
  EntryReview,
  Notification,
  RunDetail,
  RunSummary,
  Workflow,
  WorkflowDraft,
} from "./workflows.types.js";

/** Calls to the API's workflow, approval and notification routes. */

const path = (id: string) => encodeURIComponent(id);

export async function listWorkflows(): Promise<Workflow[]> {
  return (await apiRequest<{ workflows: Workflow[] }>("/workflows")).workflows;
}

export function getWorkflow(workflowId: string) {
  return apiRequest<Workflow>(`/workflows/${path(workflowId)}`);
}

export function getCatalogue() {
  return apiRequest<Catalogue>("/workflows/catalogue");
}

export function createWorkflow(workflow: WorkflowDraft) {
  return apiRequest<Workflow>("/workflows", { method: "POST", body: workflow });
}

export function updateWorkflow(workflowId: string, changes: Partial<WorkflowDraft>) {
  return apiRequest<Workflow>(`/workflows/${path(workflowId)}`, { method: "PATCH", body: changes });
}

export function deleteWorkflow(workflowId: string) {
  return apiRequest<void>(`/workflows/${path(workflowId)}`, { method: "DELETE" });
}

export function runWorkflow(
  workflowId: string,
  request: { test: boolean; sampleData?: Record<string, unknown> },
) {
  return apiRequest<RunSummary>(`/workflows/${path(workflowId)}/run`, {
    method: "POST",
    body: request,
  });
}

export function listRuns(workflowId: string) {
  return apiRequest<{ runs: RunSummary[]; total: number }>(
    `/workflows/${path(workflowId)}/runs?perPage=30`,
  );
}

export function getRun(runId: string) {
  return apiRequest<RunDetail>(`/workflow-runs/${path(runId)}`);
}

export function cancelRun(runId: string) {
  return apiRequest<RunDetail>(`/workflow-runs/${path(runId)}/cancel`, { method: "POST" });
}

export function listNotifications() {
  return apiRequest<{ unread: number; notifications: Notification[] }>("/notifications");
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<void>(`/notifications/${path(notificationId)}/read`, { method: "POST" });
}

export function markAllNotificationsRead() {
  return apiRequest<void>("/notifications/read-all", { method: "POST" });
}

export function getEntryReview(entryId: string) {
  return apiRequest<EntryReview>(`/entry-reviews/${path(entryId)}`);
}

export function submitEntryForReview(entryId: string, note: string) {
  return apiRequest<EntryReview>(`/entry-reviews/${path(entryId)}`, {
    method: "POST",
    body: { note },
  });
}

export function decideApproval(
  approvalId: string,
  decision: { decision: "approve" | "request_changes"; comment: string },
) {
  return apiRequest<unknown>(`/workflow-approvals/${path(approvalId)}/decision`, {
    method: "POST",
    body: decision,
  });
}

export async function listContentApproval(): Promise<ContentApprovalSetting[]> {
  return (await apiRequest<{ settings: ContentApprovalSetting[] }>("/content-approval")).settings;
}

export function setContentApproval(
  collection: string,
  setting: { required: boolean; reviewerRole: string; publishWhenApproved: boolean },
) {
  return apiRequest<ContentApprovalSetting>(`/content-approval/${path(collection)}`, {
    method: "PUT",
    body: setting,
  });
}
