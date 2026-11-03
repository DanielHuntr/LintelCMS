import { useQuery } from "@tanstack/react-query";
import { getMenu, listMenus } from "./menus.api.js";
import type { LinkedEntry, MenuItem } from "./menus.types.js";

/** A menu link as the page builder's canvas draws it (`DataMenuLink`). */
export interface CanvasMenuLink {
  /** The menu item's id, so a link can be styled on its own. */
  id: string;
  label: string;
  url: string | null;
  /** The page the item links to, so the page being designed can show as the current one. */
  entryId: string | null;
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
    id: item.id,
    entryId: item.entryId,
    label: item.label || (item.entryId ? (linkedEntries[item.entryId]?.title ?? "") : ""),
    url: item.url,
    current: false,
    style: item.style,
    children: canvasMenuLinks(item.children, linkedEntries),
  }));
}

/** The menus with the page being designed marked as the current page, as the website marks it. */
export function markCurrentPage<Menu extends { links: readonly CanvasMenuLink[] }>(
  menus: readonly Menu[],
  entryId: string,
): Menu[] {
  const mark = (links: readonly CanvasMenuLink[]): CanvasMenuLink[] =>
    links.map((link) => ({
      ...link,
      current: link.entryId === entryId,
      children: mark(link.children),
    }));
  return menus.map((menu) => ({ ...menu, links: mark(menu.links) }));
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
