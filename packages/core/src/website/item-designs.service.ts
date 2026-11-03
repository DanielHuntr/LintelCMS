import type { PageDocument } from "@lintel/builder-model";
import { listDeliveredEntries } from "../delivery/delivery.service.js";
import { checkPageDesign } from "./designed-pages.js";
import type { PageRequest } from "./site-pages.service.js";

/**
 * Item designs: a published page whose design says "Use this page as the design of every
 * entry in Blog posts" (`itemDesignFor`) is how every blog post is drawn, with its elements
 * showing each post's fields. The first such page found wins. Found once per cache life.
 */

const PAGES_READ = 5;
const PER_PAGE = 100;

export async function findItemDesign(
  request: PageRequest,
  collectionHandle: string,
): Promise<PageDocument | null> {
  const designs = await request.dependencies.cache.shareValue(
    `item-designs:${request.locale}`,
    () => loadItemDesigns(request),
  );
  return designs.get(collectionHandle) ?? null;
}

async function loadItemDesigns(request: PageRequest): Promise<Map<string, PageDocument>> {
  const { dependencies, context, locale } = request;
  const designs = new Map<string, PageDocument>();
  for (const collection of context.collections) {
    if (collection.structure === "dated") continue;
    for (let page = 1; page <= PAGES_READ; page += 1) {
      const list = await listDeliveredEntries(
        dependencies.database,
        collection.handle,
        { page, perPage: PER_PAGE, locale },
        dependencies.assetLookup,
        dependencies.site,
      );
      for (const entry of list.items) {
        const design = checkPageDesign(entry.data.design, context.scriptRule);
        const designFor = String(design?.root.props.itemDesignFor ?? "");
        if (design && designFor && !designs.has(designFor)) designs.set(designFor, design);
      }
      if (page * PER_PAGE >= list.total) break;
    }
  }
  return designs;
}
