import { listSiteStarts } from "../content-roots/content-roots.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { Site } from "../sites/sites.table.js";
import { buildPageTreeItems, type MenuTreePage } from "./navigation-page-tree.js";
import { listMenuTreePages } from "./navigation.repository.js";
import type { NavigationItem } from "./navigation.schema.js";
import type { Navigation } from "./navigation.table.js";

/** The items of a menu as they are now, for the admin and for websites alike. */

/** The site's pages and its home page (the site start that answers on "/"). */
export async function readMenuTree(
  database: DatabaseOrTransaction,
  site: Site,
): Promise<{ pages: MenuTreePage[]; homeId: string | null }> {
  const [pages, starts] = await Promise.all([
    listMenuTreePages(database, DEFAULT_TENANT_ID, site.id, site.locale),
    listSiteStarts(database, site.id, site.locale),
  ]);
  const home = starts.find((start) => start.isDefault) ?? starts[0];
  return { pages, homeId: home?.entryId ?? null };
}

/** A menu's items: the hand-made ones, or the page tree as it is now. */
export async function currentMenuItems(
  database: DatabaseOrTransaction,
  navigation: Navigation,
  site: Site,
): Promise<NavigationItem[]> {
  if (navigation.source !== "pageTree") return navigation.items;
  const { pages, homeId } = await readMenuTree(database, site);
  return buildPageTreeItems(pages, homeId, navigation.pageTree, navigation.maxDepth);
}
