import { apiRequest } from "../api/client.js";
import type {
  Menu,
  MenuItem,
  MenuSource,
  MenuSummary,
  PageInMenu,
  PageTreeSettings,
} from "./menus.types.js";

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
  changes: {
    name?: string;
    maxDepth?: number;
    items?: MenuItem[];
    source?: MenuSource;
    pageTree?: PageTreeSettings;
  },
): Promise<Menu> {
  return apiRequest<Menu>(`/navigation/${encodeURIComponent(handle)}`, {
    method: "PUT",
    body: changes,
  });
}

export function deleteMenu(handle: string): Promise<void> {
  return apiRequest<void>(`/navigation/${encodeURIComponent(handle)}`, { method: "DELETE" });
}

export function getPageInMenu(handle: string, entryId: string): Promise<PageInMenu> {
  return apiRequest<PageInMenu>(`/navigation/${encodeURIComponent(handle)}/pages/${entryId}`);
}

/** "In the main menu" on a page: adds or takes out its link, and sets its label there. */
export function setPageInMenu(
  handle: string,
  entryId: string,
  change: { inMenu: boolean; label?: string },
): Promise<PageInMenu> {
  return apiRequest<PageInMenu>(`/navigation/${encodeURIComponent(handle)}/pages/${entryId}`, {
    method: "PUT",
    body: change,
  });
}
