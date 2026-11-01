import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Permission } from "@lintel/core/permissions";
import { useCan } from "../session/SessionContext.js";
import {
  applyPendingModelChanges,
  type ContentModelStatus,
  dismissModelNotice,
  getContentModelStatus,
} from "./contentModelSync.api.js";

export const contentModelSyncKeys = {
  status: () => ["content-model", "status"] as const,
};

/**
 * Everything that shows the content model, by query key, so a change made in the files can
 * reload all of it at once.
 */
export const contentModelQueryKeys = [
  ["blueprints"],
  ["collections"],
  ["taxonomies"],
  ["globals"],
  ["menus"],
  contentModelSyncKeys.status(),
] as const;

export function useContentModelStatus() {
  const canRead = useCan("blueprints:read");
  return useQuery({
    queryKey: contentModelSyncKeys.status(),
    queryFn: getContentModelStatus,
    enabled: canRead,
  });
}

/** False while the content model is managed in code and locked here; true until known. */
export function useContentModelEditable(): boolean {
  return useContentModelStatus().data?.editableInAdmin ?? true;
}

/** Whether this person may make a content model change here: allowed, and not locked. */
export function useCanChangeContentModel(permission: Permission): boolean {
  const allowed = useCan(permission);
  const editable = useContentModelEditable();
  return allowed && editable;
}

export function useApplyPendingModelChanges() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: applyPendingModelChanges,
    onSuccess: async (status) => {
      queryClient.setQueryData<ContentModelStatus>(contentModelSyncKeys.status(), status);
      await Promise.all(
        contentModelQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });
}

export function useDismissModelNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dismissModelNotice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: contentModelSyncKeys.status() }),
  });
}
