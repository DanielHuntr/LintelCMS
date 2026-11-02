import { useQuery } from "@tanstack/react-query";
import { getMenu, listMenus } from "./menus.api.js";
import type { LinkedEntry, MenuItem } from "./menus.types.js";

/** A menu link as the page builder's canvas draws it (`DataMenuLink`). */
export interface CanvasMenuLink {
  label: string;
  url: string | null;
  current: boolean;
  style?: "link" | "button";
  children: CanvasMenuLink[];
}

/** The menu's items as the canvas draws them: labels filled in from the pages' titles. */
export function canvasMenuLinks(
  items: readonly MenuItem[],
  linkedEntries: Record<string, LinkedEntry>,
): CanvasMenuLink[] {
  return items.map((item) => ({
    label: item.label || (item.entryId ? (linkedEntries[item.entryId]?.title ?? "") : ""),
    url: item.url,
    current: false,
    style: item.style,
    children: canvasMenuLinks(item.children, linkedEntries),
  }));
}

/**
 * Every menu of the site with its links, for the page builder: headers and menus on the
 * canvas show the real thing, and "Which menu" can offer them. Saving a menu (here or in
 * the builder's own editor) refreshes it, since it sits under the menus' cache key.
 */
export function useBuilderMenus() {
  return useQuery({
    queryKey: ["menus", "builder"],
    queryFn: async () => {
      const summaries = await listMenus();
      const menus = await Promise.all(summaries.map((summary) => getMenu(summary.handle)));
      return menus.map((menu) => ({
        handle: menu.handle,
        name: menu.name,
        links: canvasMenuLinks(menu.items, menu.linkedEntries),
      }));
    },
    retry: false,
  });
}
