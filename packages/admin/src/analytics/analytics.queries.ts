import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAnalyticsSettings,
  getEntryVisitorStats,
  getVisitorStats,
  saveAnalyticsSettings,
  type StatsChoice,
} from "./analytics.api.js";

export const analyticsKeys = {
  stats: (choice: StatsChoice) => ["analytics", "stats", choice] as const,
  entry: (entryId: string) => ["analytics", "entries", entryId] as const,
  settings: () => ["analytics", "settings"] as const,
};

/** Figures change as people visit, so they are read again every minute while shown. */
const REFRESH_MS = 60_000;

export function useVisitorStats(choice: StatsChoice, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.stats(choice),
    queryFn: () => getVisitorStats(choice),
    enabled,
    refetchInterval: REFRESH_MS,
    placeholderData: (previous) => previous,
  });
}

export function useEntryVisitorStats(entryId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.entry(entryId ?? ""),
    queryFn: () => getEntryVisitorStats(entryId ?? ""),
    enabled: enabled && entryId !== undefined,
    refetchInterval: REFRESH_MS,
  });
}

export function useAnalyticsSettings(enabled: boolean) {
  return useQuery({ queryKey: analyticsKeys.settings(), queryFn: getAnalyticsSettings, enabled });
}

export function useSaveAnalyticsSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveAnalyticsSettings,
    onSuccess: (settings) => queryClient.setQueryData(analyticsKeys.settings(), settings),
  });
}
