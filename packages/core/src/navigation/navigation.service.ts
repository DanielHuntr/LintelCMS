import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { createContentReferences } from "../entries/entry-references.js";
import { InvalidFieldsError } from "../http/http-errors.js";
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

/** Business rules for navigation menus. The tree's own rules are in navigation-items.ts. */

export function describeNavigationSummary(navigation: Navigation): NavigationSummaryResponse {
  return {
    id: navigation.id,
    handle: navigation.handle,
    name: navigation.name,
    maxDepth: navigation.maxDepth,
    itemCount: countItems(navigation.items),
    updatedAt: navigation.updatedAt.toISOString(),
  };
}

export async function listNavigations(
  database: DatabaseOrTransaction,
): Promise<{ navigations: NavigationSummaryResponse[] }> {
  const navigations = await listNavigationRows(database, DEFAULT_TENANT_ID);
  return { navigations: navigations.map(describeNavigationSummary) };
}

export async function findNavigationOrFail(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<Navigation> {
  const navigation = await findNavigationByHandle(database, DEFAULT_TENANT_ID, handle);
  if (!navigation) {
    throw new NavigationNotFoundError(handle);
  }
  return navigation;
}

export async function findNavigation(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<NavigationResponse> {
  const navigation = await findNavigationOrFail(database, handle);
  const linked = await findLinkedEntries(database, linkedEntryIds(navigation.items));
  const linkedEntries: Record<string, LinkedEntry> = {};
  for (const entry of linked) {
    linkedEntries[entry.id] = {
      title: entry.title ?? "",
      collectionHandle: entry.collectionHandle,
      status: entry.status,
    };
  }
  return { ...describeNavigationSummary(navigation), items: navigation.items, linkedEntries };
}

export async function createNavigation(
  database: DatabaseOrTransaction,
  request: CreateNavigationRequest,
): Promise<NavigationResponse> {
  const inserted = await insertNavigationIfMissing(database, { ...request, items: [] });
  if (!inserted) {
    throw new NavigationHandleTakenError(request.handle);
  }
  return findNavigation(database, inserted.handle);
}

/**
 * Saves the name, levels or items. Items are checked as a whole tree, against the new
 * number of levels; problems come back keyed by item id, in `fields`.
 */
export async function updateNavigation(
  database: DatabaseOrTransaction,
  handle: string,
  request: UpdateNavigationRequest,
): Promise<NavigationResponse> {
  const navigation = await findNavigationOrFail(database, handle);
  const maxDepth = request.maxDepth ?? navigation.maxDepth;
  const items = request.items ?? navigation.items;
  await checkItems(database, items, maxDepth);
  await updateNavigationRow(database, navigation.id, {
    name: request.name,
    maxDepth: request.maxDepth,
    items: request.items,
  });
  return findNavigation(database, handle);
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
): Promise<void> {
  const navigation = await findNavigationOrFail(database, handle);
  await deleteNavigationRow(database, navigation.id);
}

/** Makes sure a menu with this handle exists. An existing one is left as it is. */
export async function ensureNavigation(
  database: DatabaseOrTransaction,
  defaults: Pick<Navigation, "handle" | "name" | "maxDepth">,
): Promise<void> {
  await insertNavigationIfMissing(database, { ...defaults, items: [] });
}
