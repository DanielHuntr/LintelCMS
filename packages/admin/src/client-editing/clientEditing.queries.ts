import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveReview,
  type ClientChangesRule,
  getClientEditingSettings,
  getEntryReviewState,
  listWaitingReviews,
  sendBackReview,
  sendForReview,
  updateClientEditingSettings,
} from "./clientEditing.api.js";

export const clientEditingKeys = {
  all: () => ["client-editing"] as const,
  settings: () => ["client-editing", "settings"] as const,
  entry: (entryId: string) => ["client-editing", "entry", entryId] as const,
  waiting: () => ["client-editing", "waiting"] as const,
};

export function useClientEditingSettings() {
  return useQuery({ queryKey: clientEditingKeys.settings(), queryFn: getClientEditingSettings });
}

export function useUpdateClientEditingSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rule: ClientChangesRule) => updateClientEditingSettings(rule),
    onSuccess: (settings) => {
      queryClient.setQueryData(clientEditingKeys.settings(), settings);
      void queryClient.invalidateQueries({ queryKey: clientEditingKeys.all() });
    },
  });
}

/** Where an entry's review stands for this person; nothing until the entry is saved. */
export function useEntryReviewState(entryId: string | undefined) {
  return useQuery({
    queryKey: clientEditingKeys.entry(entryId ?? ""),
    queryFn: () => getEntryReviewState(entryId ?? ""),
    enabled: entryId !== undefined,
  });
}

export function useSendForReview(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => sendForReview(entryId, note),
    onSuccess: (state) => {
      queryClient.setQueryData(clientEditingKeys.entry(entryId), state);
      void queryClient.invalidateQueries({ queryKey: clientEditingKeys.waiting() });
    },
  });
}

export function useWaitingReviews(enabled = true) {
  return useQuery({ queryKey: clientEditingKeys.waiting(), queryFn: listWaitingReviews, enabled });
}

export function useAnswerReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      answer: { reviewId: string; approve: true } | { reviewId: string; note: string },
    ) =>
      "approve" in answer
        ? approveReview(answer.reviewId)
        : sendBackReview(answer.reviewId, answer.note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientEditingKeys.all() });
      void queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}
