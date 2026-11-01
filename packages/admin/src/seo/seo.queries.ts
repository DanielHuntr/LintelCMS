import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRedirect,
  deleteRedirect,
  type EntrySeo,
  getEntrySeo,
  getSeoDefaults,
  importRedirects,
  listRedirects,
  saveEntrySeo,
  updateRedirect,
  updateSeoDefaults,
} from "./seo.api.js";

export const seoKeys = {
  defaults: () => ["seo", "defaults"] as const,
  entry: (entryId: string) => ["seo", "entries", entryId] as const,
  redirects: () => ["seo", "redirects"] as const,
};

export function useSeoDefaults() {
  return useQuery({ queryKey: seoKeys.defaults(), queryFn: getSeoDefaults });
}

export function useUpdateSeoDefaults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSeoDefaults,
    onSuccess: (defaults) => queryClient.setQueryData(seoKeys.defaults(), defaults),
  });
}

/** `entryId` is undefined for an entry that hasn't been saved yet. */
export function useEntrySeo(entryId: string | undefined) {
  return useQuery({
    queryKey: seoKeys.entry(entryId ?? ""),
    queryFn: () => getEntrySeo(entryId ?? ""),
    enabled: entryId !== undefined,
    // The panel keeps its own copy while someone is typing in it.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useSaveEntrySeo(entryId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (seo: EntrySeo) => saveEntrySeo(entryId ?? "", seo),
    onSuccess: (seo) => queryClient.setQueryData(seoKeys.entry(entryId ?? ""), seo),
  });
}

export function useRedirects() {
  return useQuery({ queryKey: seoKeys.redirects(), queryFn: listRedirects });
}

function useRedirectMutation<Variables, Result>(
  mutationFn: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: seoKeys.redirects() }),
  });
}

export function useCreateRedirect() {
  return useRedirectMutation(createRedirect);
}

export function useAcceptRedirect() {
  return useRedirectMutation((redirectId: string) =>
    updateRedirect(redirectId, { status: "active" }),
  );
}

export function useDeleteRedirect() {
  return useRedirectMutation(deleteRedirect);
}

export function useImportRedirects() {
  return useRedirectMutation(importRedirects);
}
