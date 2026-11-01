import type { PageView, PostView } from "@lintel/site-components";
import type { DeliveredEntryWithTranslations } from "../delivery/delivery.schema.js";
import { listDeliveredEntries } from "../delivery/delivery.service.js";
import { entryAsItem } from "./bound-entries.js";
import { checkPageDesign, drawPageDesign } from "./designed-pages.js";
import { findItemDesign } from "./item-designs.service.js";
import { loadPageData } from "./page-data.service.js";
import { localiseUrl } from "./site-chrome.service.js";
import type { PageRequest } from "./site-pages.service.js";

/**
 * An entry's page, with its design drawn and filled in:
 *
 * - A page with a design of its own is drawn with its lists loaded. Its bound elements show
 *   its own fields; when it is an item design, they show the newest entry it is the design
 *   for, so the design can be looked at on its own address.
 * - An entry of a collection with an item design is drawn with that design, its elements
 *   showing this entry's fields.
 * - Anything else is left as it was.
 */
export async function designEntryView(
  request: PageRequest,
  collectionHandle: string,
  entry: DeliveredEntryWithTranslations,
  view: PageView | PostView,
): Promise<PageView | PostView> {
  const { locale, context } = request;
  const url = localiseUrl(entry.url ?? `/${entry.slug}`, locale, context.defaultLocale);
  const own = view.kind === "page" ? checkPageDesign(entry.data.design) : null;
  if (view.kind === "page" && own) {
    const designFor = String(own.root.props.itemDesignFor ?? "");
    const sampleData = designFor ? await loadSample(request, designFor) : undefined;
    const data = await loadPageData(request, own, {
      item: sampleData ?? entryAsItem(entry, url, locale),
      currentEntry: { id: entry.id, collection: collectionHandle },
    });
    return { ...view, design: drawPageDesign(own, data) };
  }
  const itemDesign = await findItemDesign(request, collectionHandle);
  if (!itemDesign) return view;
  const data = await loadPageData(request, itemDesign, {
    item: entryAsItem(entry, url, locale),
    currentEntry: { id: entry.id, collection: collectionHandle },
  });
  return {
    kind: "page",
    title: view.title,
    summary: view.kind === "page" ? view.summary : view.excerpt,
    heroImage: view.kind === "page" ? view.heroImage : view.image,
    body: view.body,
    sections: [],
    design: drawPageDesign(itemDesign, data),
  };
}

/** The newest entry of a collection, as the example an item design shows on its own page. */
async function loadSample(request: PageRequest, collectionHandle: string) {
  const collection = request.context.collections.find(({ handle }) => handle === collectionHandle);
  if (!collection) return undefined;
  const list = await listDeliveredEntries(
    request.dependencies.database,
    collection.handle,
    { page: 1, perPage: 1, locale: request.locale },
    request.dependencies.assetLookup,
  );
  const [first] = list.items;
  if (!first) return undefined;
  const url = localiseUrl(
    first.url ?? `/${first.slug}`,
    request.locale,
    request.context.defaultLocale,
  );
  return entryAsItem(first, url, request.locale);
}
