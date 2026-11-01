import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearRoleLayout,
  type EntryWidgetList,
  fetchDashboardLayout,
  fetchEntryWidgetList,
  fetchMediaUsage,
  fetchRoleLayouts,
  resetDashboardLayout,
  saveDashboardLayout,
  saveRoleLayout,
} from "./dashboard.api.js";
import type { WidgetPlacement } from "./dashboardLayout.js";

export const dashboardKeys = {
  layout: () => ["dashboard", "layout"] as const,
  roleLayouts: () => ["dashboard", "role-layouts"] as const,
  entries: (list: EntryWidgetList) => ["dashboard", "widgets", list] as const,
  media: () => ["dashboard", "widgets", "media-usage"] as const,
};

export function useDashboardLayout() {
  return useQuery({ queryKey: dashboardKeys.layout(), queryFn: fetchDashboardLayout });
}

export function useSaveDashboardLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveDashboardLayout,
    onSuccess: (layout) => queryClient.setQueryData(dashboardKeys.layout(), layout),
  });
}

export function useResetDashboardLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetDashboardLayout,
    onSuccess: (layout) => queryClient.setQueryData(dashboardKeys.layout(), layout),
  });
}

export function useRoleLayouts(enabled: boolean) {
  return useQuery({ queryKey: dashboardKeys.roleLayouts(), queryFn: fetchRoleLayouts, enabled });
}

export function useSaveRoleLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, widgets }: { roleId: string; widgets: WidgetPlacement[] }) =>
      saveRoleLayout(roleId, widgets),
    onSuccess: (roles) => queryClient.setQueryData(dashboardKeys.roleLayouts(), roles),
  });
}

export function useClearRoleLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearRoleLayout,
    onSuccess: (roles) => queryClient.setQueryData(dashboardKeys.roleLayouts(), roles),
  });
}

export function useEntryWidgetList(list: EntryWidgetList) {
  return useQuery({
    queryKey: dashboardKeys.entries(list),
    queryFn: () => fetchEntryWidgetList(list),
  });
}

export function useMediaUsage() {
  return useQuery({ queryKey: dashboardKeys.media(), queryFn: fetchMediaUsage });
}
