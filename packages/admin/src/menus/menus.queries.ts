import { useQuery } from "@tanstack/react-query";
import { getMenu, getPageInMenu, listMenus } from "./menus.api.js";

export const menuKeys = {
  menus: () => ["menus"] as const,
  menu: (handle: string) => ["menus", handle] as const,
  page: (handle: string, entryId: string) => ["menus", handle, "pages", entryId] as const,
};

export function usePageInMenu(handle: string, entryId: string, enabled = true) {
  return useQuery({
    queryKey: menuKeys.page(handle, entryId),
    queryFn: () => getPageInMenu(handle, entryId),
    enabled,
    retry: false,
  });
}

export function useMenus() {
  return useQuery({ queryKey: menuKeys.menus(), queryFn: listMenus });
}

export function useMenu(handle: string) {
  return useQuery({
    queryKey: menuKeys.menu(handle),
    queryFn: () => getMenu(handle),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
