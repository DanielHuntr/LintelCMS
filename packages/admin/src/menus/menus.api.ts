import { apiRequest } from "../api/client.js";
import type { Menu, MenuItem, MenuSummary } from "./menus.types.js";

/** Calls to the API's navigation routes. One function per route. */

export async function listMenus(): Promise<MenuSummary[]> {
  const { navigations } = await apiRequest<{ navigations: MenuSummary[] }>("/navigation");
  return navigations;
}

export function getMenu(handle: string): Promise<Menu> {
  return apiRequest<Menu>(`/navigation/${encodeURIComponent(handle)}`);
}

export function createMenu(menu: { handle: string; name: string; maxDepth: number }) {
  return apiRequest<Menu>("/navigation", { method: "POST", body: menu });
}

export function saveMenu(
  handle: string,
  changes: { name?: string; maxDepth?: number; items?: MenuItem[] },
): Promise<Menu> {
  return apiRequest<Menu>(`/navigation/${encodeURIComponent(handle)}`, {
    method: "PUT",
    body: changes,
  });
}

export function deleteMenu(handle: string): Promise<void> {
  return apiRequest<void>(`/navigation/${encodeURIComponent(handle)}`, { method: "DELETE" });
}
