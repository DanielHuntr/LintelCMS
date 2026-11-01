import type { EntryStatus } from "../content/content.types.js";

/** One item of a menu, as the API stores it: a link to an entry or to an address. */
export interface MenuItem {
  id: string;
  label: string;
  entryId: string | null;
  url: string | null;
  newTab: boolean;
  children: MenuItem[];
}

/** A menu in a list. Matches the API's `NavigationSummary`. */
export interface MenuSummary {
  id: string;
  handle: string;
  name: string;
  maxDepth: number;
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
  items: MenuItem[];
  /** The entries items link to, by id. A missing id is an entry that was deleted. */
  linkedEntries: Record<string, LinkedEntry>;
}
