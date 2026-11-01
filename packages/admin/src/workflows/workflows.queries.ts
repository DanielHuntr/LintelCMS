import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelRun,
  createWorkflow,
  decideApproval,
  deleteWorkflow,
  getCatalogue,
  getEntryReview,
  getRun,
  getWorkflow,
  listContentApproval,
  listNotifications,
  listRuns,
  listWorkflows,
  markAllNotificationsRead,
  markNotificationRead,
  runWorkflow,
  setContentApproval,
  submitEntryForReview,
  updateWorkflow,
} from "./workflows.api.js";
import type { RunStatus, WorkflowDraft } from "./workflows.types.js";

export const workflowKeys = {
  all: () => ["workflows"] as const,
  list: () => ["workflows", "list"] as const,
  catalogue: () => ["workflows", "catalogue"] as const,
  workflow: (workflowId: string) => ["workflows", workflowId] as const,
  runs: (workflowId: string) => ["workflows", workflowId, "runs"] as const,
  run: (runId: string) => ["workflow-runs", runId] as const,
  notifications: () => ["notifications"] as const,
  review: (entryId: string) => ["entry-review", entryId] as const,
  contentApproval: () => ["content-approval"] as const,
};

const unfinished: readonly RunStatus[] = ["queued", "running"];

export function useWorkflows() {
  return useQuery({ queryKey: workflowKeys.list(), queryFn: listWorkflows });
}

export function useWorkflow(workflowId: string | undefined) {
  return useQuery({
    queryKey: workflowKeys.workflow(workflowId ?? "new"),
    queryFn: () => getWorkflow(workflowId ?? ""),
    enabled: workflowId !== undefined,
  });
}

export function useCatalogue() {
  return useQuery({ queryKey: workflowKeys.catalogue(), queryFn: getCatalogue, staleTime: 60_000 });
}

/** The history refreshes while a run is still going. */
export function useRuns(workflowId: string) {
  return useQuery({
    queryKey: workflowKeys.runs(workflowId),
    queryFn: () => listRuns(workflowId),
    refetchInterval: (query) =>
      query.state.data?.runs.some((run) => unfinished.includes(run.status)) ? 2000 : false,
  });
}

export function useRun(runId: string | undefined) {
  return useQuery({
    queryKey: workflowKeys.run(runId ?? ""),
    queryFn: () => getRun(runId ?? ""),
    enabled: runId !== undefined,
    refetchInterval: (query) =>
      query.state.data && unfinished.includes(query.state.data.status) ? 2000 : false,
  });
}

export function useSaveWorkflow(workflowId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: WorkflowDraft) =>
      workflowId ? updateWorkflow(workflowId, draft) : createWorkflow(draft),
    onSuccess: (workflow) => {
      queryClient.setQueryData(workflowKeys.workflow(workflow.id), workflow);
      return queryClient.invalidateQueries({ queryKey: workflowKeys.list() });
    },
  });
}

export function useToggleWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, enabled }: { workflowId: string; enabled: boolean }) =>
      updateWorkflow(workflowId, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workflowKeys.all() }),
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workflowKeys.all() }),
  });
}

export function useRunWorkflow(workflowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: { test: boolean; sampleData?: Record<string, unknown> }) =>
      runWorkflow(workflowId, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workflowKeys.runs(workflowId) }),
  });
}

export function useCancelRun(workflowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelRun,
    onSuccess: (run) => {
      queryClient.setQueryData(workflowKeys.run(run.id), run);
      return queryClient.invalidateQueries({ queryKey: workflowKeys.runs(workflowId) });
    },
  });
}

/** Checked every half minute, so a new review request shows up without a reload. */
export function useNotifications() {
  return useQuery({
    queryKey: workflowKeys.notifications(),
    queryFn: listNotifications,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string | undefined) =>
      notificationId ? markNotificationRead(notificationId) : markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workflowKeys.notifications() }),
  });
}

export function useEntryReview(entryId: string | undefined) {
  return useQuery({
    queryKey: workflowKeys.review(entryId ?? ""),
    queryFn: () => getEntryReview(entryId ?? ""),
    enabled: entryId !== undefined,
  });
}

export function useSubmitForReview(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => submitEntryForReview(entryId, note),
    onSuccess: (review) => queryClient.setQueryData(workflowKeys.review(entryId), review),
  });
}

/** After an answer the run carries on in the background, so look again shortly after. */
export function useDecideApproval(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      approvalId,
      ...decision
    }: {
      approvalId: string;
      decision: "approve" | "request_changes";
      comment: string;
    }) => decideApproval(approvalId, decision),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workflowKeys.review(entryId) });
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: workflowKeys.review(entryId) });
        void queryClient.invalidateQueries({ queryKey: ["entries"] });
      }, 1500);
    },
  });
}

export function useContentApproval() {
  return useQuery({ queryKey: workflowKeys.contentApproval(), queryFn: listContentApproval });
}

export function useSetContentApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      collection,
      ...setting
    }: {
      collection: string;
      required: boolean;
      reviewerRole: string;
      publishWhenApproved: boolean;
    }) => setContentApproval(collection, setting),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workflowKeys.contentApproval() }),
  });
}
