import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type DeliveredEntryLink,
  findDeliveredEntryLinks,
} from "../delivery/delivered-references.js";
import { resolveLocale } from "../sites/locales.service.js";
import type { Site } from "../sites/sites.table.js";
import { linkedEntryIds } from "./navigation-items.js";
import type { DeliveredNavigationItem, NavigationItem } from "./navigation.schema.js";
import { findNavigationOrFail } from "./navigation.service.js";
import { currentMenuItems } from "./navigation-tree-items.service.js";

/**
 * A menu for websites. Entry links become the entry's address in the language asked
 * for (its translation when there is one). An item linking to an entry that isn't
 * published is left out, with the items inside it, so a site never links to a missing page.
 */
export async function deliverNavigation(
  database: DatabaseOrTransaction,
  handle: string,
  requestedLocale: string | undefined,
  forSite?: Site,
): Promise<{ handle: string; name: string; locale: string; items: DeliveredNavigationItem[] }> {
  const { site, locale } = await resolveLocale(database, requestedLocale, forSite);
  const navigation = await findNavigationOrFail(database, handle, site);
  const items = await currentMenuItems(database, navigation, site);
  const links = await findDeliveredEntryLinks(database, linkedEntryIds(items), locale);
  return {
    handle: navigation.handle,
    name: navigation.name,
    locale,
    items: deliverItems(items, links),
  };
}

export function deliverItems(
  items: readonly NavigationItem[],
  links: ReadonlyMap<string, DeliveredEntryLink>,
): DeliveredNavigationItem[] {
  return items.flatMap((item) => {
    const link = item.entryId === null ? undefined : links.get(item.entryId);
    if (item.entryId !== null && !link) {
      return [];
    }
    return [
      {
        label: item.label || link?.title || "",
        url: link ? link.url : item.url,
        newTab: item.newTab,
        style: item.style ?? "link",
        entryId: link ? link.id : null,
        children: deliverItems(item.children, links),
      },
    ];
  });
}
