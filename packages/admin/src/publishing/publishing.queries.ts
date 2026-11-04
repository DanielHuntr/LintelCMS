import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  createPublishTarget,
  deletePublishTarget,
  getPublishRun,
  listPublishRuns,
  listPublishTargets,
  publishWebsite,
  type PublishTargetInput,
  testPublishTarget,
  updatePublishTarget,
} from "./publishing.api.js";

export const publishingKeys = {
  all: () => ["publishing"] as const,
  targets: () => ["publishing", "targets"] as const,
  runs: (targetId: string) => ["publishing", targetId, "runs"] as const,
  run: (targetId: string, runId: string) => ["publishing", targetId, "runs", runId] as const,
};

export function usePublishTargets() {
  return useQuery({ queryKey: publishingKeys.targets(), queryFn: listPublishTargets });
}

/** The history refreshes while a publish is under way. */
export function usePublishRuns(targetId: string) {
  return useQuery({
    queryKey: publishingKeys.runs(targetId),
    queryFn: () => listPublishRuns(targetId),
    refetchInterval: (query) =>
      query.state.data?.some((run) => run.status === "running") ? 2000 : false,
  });
}

/** One publish, followed every second until it is over, for the progress bar. */
export function usePublishRun(targetId: string, runId: string | null) {
  const queryClient = useQueryClient();
  const run = useQuery({
    queryKey: publishingKeys.run(targetId, runId ?? "none"),
    queryFn: () => getPublishRun(targetId, runId ?? ""),
    enabled: runId !== null,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 1000 : false),
  });
  // Once it's over, the destination's "Last published" and the history have changed.
  const status = run.data?.status;
  useEffect(() => {
    if (!status || status === "running") return;
    void queryClient.invalidateQueries({ queryKey: publishingKeys.targets() });
    void queryClient.invalidateQueries({ queryKey: publishingKeys.runs(targetId) });
  }, [status, queryClient, targetId]);
  return run;
}

export function useCreatePublishTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPublishTarget,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: publishingKeys.targets() }),
  });
}

export function useUpdatePublishTarget(targetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: Partial<PublishTargetInput>) => updatePublishTarget(targetId, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: publishingKeys.targets() }),
  });
}

export function useDeletePublishTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePublishTarget,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: publishingKeys.all() }),
  });
}

export function useTestPublishTarget(targetId: string) {
  return useMutation({ mutationFn: () => testPublishTarget(targetId) });
}

export function usePublishWebsite(targetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: { confirmDeletions?: boolean }) => publishWebsite(targetId, options),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: publishingKeys.runs(targetId) }),
  });
}
