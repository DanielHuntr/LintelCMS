import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { createContentReferences } from "../entries/entry-references.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { siteOrDefault } from "../sites/sites.service.js";
import { currentMenuItems } from "./navigation-tree-items.service.js";
import type { Site } from "../sites/sites.table.js";
import { NavigationHandleTakenError, NavigationNotFoundError } from "./navigation.errors.js";
import {
  countItems,
  findNavigationProblems,
  linkedEntryIds,
  walkItems,
} from "./navigation-items.js";
import {
  deleteNavigationRow,
  findLinkedEntries,
  findNavigationByHandle,
  insertNavigationIfMissing,
  listNavigationRows,
  updateNavigationRow,
} from "./navigation.repository.js";
import type {
  CreateNavigationRequest,
  LinkedEntry,
  NavigationItem,
  NavigationResponse,
  NavigationSummaryResponse,
  UpdateNavigationRequest,
} from "./navigation.schema.js";
import type { Navigation } from "./navigation.table.js";

/**
 * Business rules for navigation menus. The tree's own rules are in navigation-items.ts.
 * Each site has its own menus; every function takes the site last, and means the default
 * site when it is left out.
 */

export function describeNavigationSummary(navigation: Navigation): NavigationSummaryResponse {
  return {
    id: navigation.id,
    handle: navigation.handle,
    name: navigation.name,
    maxDepth: navigation.maxDepth,
    source: navigation.source,
    itemCount: countItems(navigation.items),
    updatedAt: navigation.updatedAt.toISOString(),
  };
}

export async function listNavigations(
  database: DatabaseOrTransaction,
  forSite?: Site,
): Promise<{ navigations: NavigationSummaryResponse[] }> {
  const site = await siteOrDefault(database, forSite);
  const navigations = await listNavigationRows(database, DEFAULT_TENANT_ID, site.id);
  return { navigations: navigations.map(describeNavigationSummary) };
}

export async function findNavigationOrFail(
  database: DatabaseOrTransaction,
  handle: string,
  forSite?: Site,
): Promise<Navigation> {
  const site = await siteOrDefault(database, forSite);
  const navigation = await findNavigationByHandle(database, DEFAULT_TENANT_ID, site.id, handle);
  if (!navigation) {
    throw new NavigationNotFoundError(handle);
  }
  return navigation;
}

export async function findNavigation(
  database: DatabaseOrTransaction,
  handle: string,
  forSite?: Site,
): Promise<NavigationResponse> {
  const site = await siteOrDefault(database, forSite);
  const navigation = await findNavigationOrFail(database, handle, site);
  const items = await currentMenuItems(database, navigation, site);
  // Hidden pages are named too, so the editor can list them to show again.
  const linked = await findLinkedEntries(database, [
    ...linkedEntryIds(items),
    ...(navigation.source === "pageTree" ? navigation.pageTree.hiddenEntryIds : []),
  ]);
  const linkedEntries: Record<string, LinkedEntry> = {};
  for (const entry of linked) {
    linkedEntries[entry.id] = {
      title: entry.title ?? "",
      collectionHandle: entry.collectionHandle,
      status: entry.status,
    };
  }
  return {
    ...describeNavigationSummary(navigation),
    items,
    pageTree: navigation.pageTree,
    linkedEntries,
  };
}

export async function createNavigation(
  database: DatabaseOrTransaction,
  request: CreateNavigationRequest,
  forSite?: Site,
): Promise<NavigationResponse> {
  const site = await siteOrDefault(database, forSite);
  const inserted = await insertNavigationIfMissing(database, {
    ...request,
    siteId: site.id,
    items: [],
  });
  if (!inserted) {
    throw new NavigationHandleTakenError(request.handle);
  }
  return findNavigation(database, inserted.handle, site);
}

/**
 * Saves the name, levels, items, or where the items come from. Items are checked as a whole
 * tree, against the new number of levels; problems come back keyed by item id, in `fields`.
 * Switching to the page tree keeps the hand-made items, for switching back.
 */
export async function updateNavigation(
  database: DatabaseOrTransaction,
  handle: string,
  request: UpdateNavigationRequest,
  forSite?: Site,
): Promise<NavigationResponse> {
  const navigation = await findNavigationOrFail(database, handle, forSite);
  const maxDepth = request.maxDepth ?? navigation.maxDepth;
  const items = request.items ?? navigation.items;
  await checkItems(database, items, maxDepth);
  await updateNavigationRow(database, navigation.id, {
    name: request.name,
    maxDepth: request.maxDepth,
    items: request.items,
    source: request.source,
    pageTree: request.pageTree,
  });
  return findNavigation(database, handle, forSite);
}

async function checkItems(
  database: DatabaseOrTransaction,
  items: readonly NavigationItem[],
  maxDepth: number,
): Promise<void> {
  const problems = findNavigationProblems(items, maxDepth);
  const missing = new Set(
    await createContentReferences(database).findMissingEntryIds([], linkedEntryIds(items)),
  );
  for (const { item } of walkItems(items)) {
    if (item.entryId !== null && missing.has(item.entryId)) {
      problems[item.id] ??= "The page this item linked to has been deleted";
    }
  }
  if (Object.keys(problems).length > 0) {
    throw new InvalidFieldsError(problems);
  }
}

export async function deleteNavigation(
  database: DatabaseOrTransaction,
  handle: string,
  forSite?: Site,
): Promise<void> {
  const navigation = await findNavigationOrFail(database, handle, forSite);
  await deleteNavigationRow(database, navigation.id);
}

/** Makes sure the site has a menu with this handle. An existing one is left as it is. */
export async function ensureNavigation(
  database: DatabaseOrTransaction,
  defaults: Pick<Navigation, "handle" | "name" | "maxDepth">,
  forSite?: Site,
): Promise<void> {
  const site = await siteOrDefault(database, forSite);
  await insertNavigationIfMissing(database, {
    handle: defaults.handle,
    name: defaults.name,
    maxDepth: defaults.maxDepth,
    siteId: site.id,
    items: [],
  });
}

/**
 * Gives a new site an empty menu for each of another site's, so a website that prints
 * "main" and "footer" finds them on every site. The items are left for editors to fill in,
 * since they link to the other site's pages.
 */
export async function copyMenusToSite(
  database: DatabaseOrTransaction,
  from: Site,
  to: Site,
): Promise<void> {
  for (const navigation of await listNavigationRows(database, DEFAULT_TENANT_ID, from.id)) {
    await ensureNavigation(database, navigation, to);
  }
}
