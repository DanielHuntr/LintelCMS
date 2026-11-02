import type { EntryStatus } from "../content/content.types.js";

/** One item of a menu, as the API stores it: a link to an entry or to an address. */
export interface MenuItem {
  id: string;
  label: string;
  entryId: string | null;
  url: string | null;
  newTab: boolean;
  /** "button" draws it as a button ("Book now"). Menus saved before have none: a link. */
  style?: MenuItemStyle;
  children: MenuItem[];
}

export type MenuItemStyle = "link" | "button";

/** Where a menu's items come from: arranged by hand, or the site's page tree. */
export type MenuSource = "items" | "pageTree";

/** What a menu that follows the page tree changes per page. */
export interface PageTreeSettings {
  includeHome: boolean;
  hiddenEntryIds: string[];
  labels: Record<string, string>;
}

/** A menu in a list. Matches the API's `NavigationSummary`. */
export interface MenuSummary {
  id: string;
  handle: string;
  name: string;
  maxDepth: number;
  source: MenuSource;
  itemCount: number;
  updatedAt: string;
}

export interface LinkedEntry {
  title: string;
  collectionHandle: string;
  status: EntryStatus;
}

/** A whole menu, as the editor loads it. */
export interface Menu extends MenuSummary {
  /** Following the page tree: the pages it shows now. Otherwise the items made by hand. */
  items: MenuItem[];
  pageTree: PageTreeSettings;
  /** The entries items link to, by id. A missing id is an entry that was deleted. */
  linkedEntries: Record<string, LinkedEntry>;
}

/** Whether a page is in a menu ("In the main menu" on the page). */
export interface PageInMenu {
  menu: { handle: string; name: string; source: MenuSource };
  inMenu: boolean;
  label: string;
}
