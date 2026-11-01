import type { DatabaseOrTransaction } from "../database/client.js";
import { EntryNotFoundError } from "../entries/entries.errors.js";
import { siteOrDefault } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";
import { NotAPageError } from "./navigation.errors.js";
import { currentMenuItems, readMenuTree } from "./navigation-tree-items.service.js";
import { findMenuPageRow } from "./navigation.repository.js";
import type { PageInMenuRequest, PageInMenuResponse } from "./navigation.schema.js";
import { findNavigationOrFail, updateNavigation } from "./navigation.service.js";
import type { Navigation } from "./navigation.table.js";
import { addPageItem, findPageItem, labelPageItems, removePageItems } from "./page-menu-items.js";

/**
 * Menus and the page tree: the items of a menu that follows the tree, and "In the main
 * menu" on a page, which changes the same menu the Menus screen shows (an item for a menu
 * arranged by hand, "Hide from menu" for one that follows the tree).
 */

async function findPageOrFail(database: DatabaseOrTransaction, entryId: string) {
  const page = await findMenuPageRow(database, entryId);
  if (!page) throw new EntryNotFoundError();
  if (page.structure !== "tree" || page.routePattern === null) throw new NotAPageError();
  return page;
}

export async function findPageInMenu(
  database: DatabaseOrTransaction,
  handle: string,
  entryId: string,
  forSite?: Site,
): Promise<PageInMenuResponse> {
  await findPageOrFail(database, entryId);
  const site = await siteOrDefault(database, forSite);
  const navigation = await findNavigationOrFail(database, handle, site);
  return describePageInMenu(database, navigation, site, entryId);
}

async function describePageInMenu(
  database: DatabaseOrTransaction,
  navigation: Navigation,
  site: Site,
  entryId: string,
): Promise<PageInMenuResponse> {
  const menu = { handle: navigation.handle, name: navigation.name, source: navigation.source };
  if (navigation.source === "pageTree") {
    const items = await currentMenuItems(database, navigation, site);
    return {
      menu,
      inMenu: findPageItem(items, entryId) !== undefined,
      label: navigation.pageTree.labels[entryId] ?? "",
    };
  }
  const item = findPageItem(navigation.items, entryId);
  return { menu, inMenu: item !== undefined, label: item?.label ?? "" };
}

/**
 * Switches "In the main menu" on or off for a page. A hand-made menu gets an item under
 * the parent page's item (or beside its siblings'), or loses the page's items; a menu that
 * follows the tree hides or shows the page.
 */
export async function setPageInMenu(
  database: DatabaseOrTransaction,
  handle: string,
  entryId: string,
  request: PageInMenuRequest,
  forSite?: Site,
): Promise<PageInMenuResponse> {
  const page = await findPageOrFail(database, entryId);
  const site = await siteOrDefault(database, forSite);
  const navigation = await findNavigationOrFail(database, handle, site);

  if (navigation.source === "pageTree") {
    const hidden = new Set(navigation.pageTree.hiddenEntryIds);
    if (request.inMenu) hidden.delete(entryId);
    else hidden.add(entryId);
    const labels = { ...navigation.pageTree.labels };
    if (request.label !== undefined) {
      if (request.label === "") delete labels[entryId];
      else labels[entryId] = request.label;
    }
    await updateNavigation(
      database,
      handle,
      { pageTree: { ...navigation.pageTree, hiddenEntryIds: [...hidden], labels } },
      site,
    );
  } else {
    const label = request.label ?? findPageItem(navigation.items, entryId)?.label ?? "";
    const { pages, homeId } = await readMenuTree(database, site);
    const siblingIds = pages
      .filter((candidate) => candidate.parentId === page.parentId)
      .map((candidate) => candidate.id);
    const items = request.inMenu
      ? addPageItem(
          navigation.items,
          {
            entryId,
            parentId: page.parentId,
            isUnderHome: page.parentId !== null && page.parentId === homeId,
            siblingIds,
          },
          label,
          navigation.maxDepth,
        )
      : removePageItems(navigation.items, entryId);
    await updateNavigation(
      database,
      handle,
      { items: request.inMenu ? labelPageItems(items, entryId, label) : items },
      site,
    );
  }
  const saved = await findNavigationOrFail(database, handle, site);
  return describePageInMenu(database, saved, site, entryId);
}
