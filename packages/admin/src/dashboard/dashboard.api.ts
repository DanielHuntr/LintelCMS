import { apiRequest } from "../api/client.js";
import type { WidgetPlacement } from "./dashboardLayout.js";

/** Calls to the API's dashboard routes (see packages/core/src/dashboard). */

/** Whose layout this is: the person's own, their role's default, or none saved yet. */
export interface DashboardLayout {
  widgets: WidgetPlacement[] | null;
  source: "user" | "role" | "default";
}

export interface RoleLayout {
  id: string;
  name: string;
  widgets: WidgetPlacement[] | null;
}

export interface DashboardEntry {
  id: string;
  title: string;
  status: "draft" | "published" | "scheduled";
  collection: { handle: string; name: string };
  updatedAt: string;
  updatedByName: string | null;
  scheduledFor: string | null;
  hasUnpublishedChanges: boolean;
}

export interface DashboardEntryList {
  entries: DashboardEntry[];
  total: number;
}

export interface MediaUsage {
  fileCount: number;
  totalBytes: number;
  imageCount: number;
  imagesWithoutAltText: number;
}

export const fetchDashboardLayout = () => apiRequest<DashboardLayout>("/dashboard/layout");

export const saveDashboardLayout = (widgets: WidgetPlacement[]) =>
  apiRequest<DashboardLayout>("/dashboard/layout", { method: "PUT", body: { widgets } });

export const resetDashboardLayout = () =>
  apiRequest<DashboardLayout>("/dashboard/layout", { method: "DELETE" });

export async function fetchRoleLayouts(): Promise<RoleLayout[]> {
  return (await apiRequest<{ roles: RoleLayout[] }>("/dashboard/role-layouts")).roles;
}

export async function saveRoleLayout(roleId: string, widgets: WidgetPlacement[]) {
  const path = `/dashboard/role-layouts/${encodeURIComponent(roleId)}`;
  return (await apiRequest<{ roles: RoleLayout[] }>(path, { method: "PUT", body: { widgets } }))
    .roles;
}

export async function clearRoleLayout(roleId: string) {
  const path = `/dashboard/role-layouts/${encodeURIComponent(roleId)}`;
  return (await apiRequest<{ roles: RoleLayout[] }>(path, { method: "DELETE" })).roles;
}

export type EntryWidgetList = "recent-edits" | "scheduled" | "needs-attention";

export const fetchEntryWidgetList = (list: EntryWidgetList) =>
  apiRequest<DashboardEntryList>(`/dashboard/widgets/${list}`);

export const fetchMediaUsage = () => apiRequest<MediaUsage>("/dashboard/widgets/media-usage");
