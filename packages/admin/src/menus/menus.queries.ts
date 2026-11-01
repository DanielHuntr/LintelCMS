import { useQuery } from "@tanstack/react-query";
import { getMenu, listMenus } from "./menus.api.js";

export const menuKeys = {
  menus: () => ["menus"] as const,
  menu: (handle: string) => ["menus", handle] as const,
};

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
