import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPersonalDataMap,
  getPolicyHelper,
  getProcessors,
  getRetention,
  listPrivacyRequests,
  type Processor,
  type RetentionRuleId,
  saveProcessors,
  updateRetention,
} from "./privacy.api.js";

export const privacyKeys = {
  all: ["privacy"] as const,
  map: () => [...privacyKeys.all, "map"] as const,
  requests: () => [...privacyKeys.all, "requests"] as const,
  retention: () => [...privacyKeys.all, "retention"] as const,
  policy: () => [...privacyKeys.all, "policy"] as const,
  processors: () => [...privacyKeys.all, "processors"] as const,
};

export function usePersonalDataMap() {
  return useQuery({ queryKey: privacyKeys.map(), queryFn: getPersonalDataMap });
}

export function usePrivacyRequests() {
  return useQuery({ queryKey: privacyKeys.requests(), queryFn: listPrivacyRequests });
}

export function useRetention() {
  return useQuery({ queryKey: privacyKeys.retention(), queryFn: getRetention });
}

export function useUpdateRetention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: Partial<Record<RetentionRuleId, { enabled: boolean; days: number }>>) =>
      updateRetention(changes),
    onSuccess: (data) => queryClient.setQueryData(privacyKeys.retention(), data),
  });
}

export function usePolicyHelper() {
  return useQuery({ queryKey: privacyKeys.policy(), queryFn: getPolicyHelper });
}

export function useProcessors() {
  return useQuery({ queryKey: privacyKeys.processors(), queryFn: getProcessors });
}

export function useSaveProcessors() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (processors: Array<Omit<Processor, "origin">>) => saveProcessors(processors),
    onSuccess: (data) => queryClient.setQueryData(privacyKeys.processors(), data),
  });
}
