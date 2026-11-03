import {
  type CollectionListData,
  findNodesOfType,
  type PageData,
  type PageDocument,
  type ProductListData,
} from "@lintel/builder-model";
import type { CanvasSite } from "../canvas/canvas-frame-script.js";
import { sampleSite } from "../render/elements/navigation.js";
import type { BuilderDataSources } from "./data-sources.js";

/**
 * What the canvas shows in dynamic elements: each collection list gets its collection's
 * sample entries (up to its limit), and an item page the first sample of its collection,
 * so a design is made with real-looking content. Lists without samples show each field's
 * name instead (see the collection list's drawing). Headers and footers show the site's own
 * name, logo and menus when the app passes them, else a sample site's.
 */
export function canvasPageData(
  document: PageDocument,
  sources: BuilderDataSources,
  canvasSite?: CanvasSite,
): PageData {
  const samplesOf = (handle: string) =>
    sources.collections.find((collection) => collection.handle === handle)?.samples ?? [];
  const lists: Record<string, CollectionListData> = {};
  for (const node of findNodesOfType(document.root, ["collectionList"])) {
    const samples = samplesOf(String(node.props.collection ?? ""));
    if (samples.length === 0) continue;
    const limit = typeof node.props.limit === "number" ? node.props.limit : 6;
    lists[node.id] = {
      items: samples.slice(0, Math.min(limit, 6)),
      page: 1,
      totalPages: 1,
      previousUrl: null,
      nextUrl: null,
    };
  }
  const productLists: Record<string, ProductListData> = {};
  if (sources.sampleProducts && sources.sampleProducts.length > 0) {
    for (const node of findNodesOfType(document.root, ["productGrid"])) {
      productLists[node.id] = {
        products: sources.sampleProducts.slice(0, 8),
        page: 1,
        totalPages: 1,
        previousUrl: null,
        nextUrl: null,
        sortUrls: {},
        sort: String(node.props.sort ?? "featured"),
      };
    }
  }
  const itemFor = String(document.root.props.itemDesignFor ?? "");
  const menus = sources.menus;
  const site =
    menus || canvasSite?.siteName !== undefined
      ? {
          ...sampleSite,
          ...(canvasSite?.siteName !== undefined && {
            siteName: canvasSite.siteName,
            logo: canvasSite.logo ?? null,
            socialLinks: canvasSite.socialLinks ?? [],
            footerText: canvasSite.footerText ?? "",
          }),
          ...(menus && {
            menu: menus.find((menu) => menu.handle === "main")?.links ?? [],
            menus: Object.fromEntries(menus.map((menu) => [menu.handle, menu.links])),
          }),
        }
      : undefined;
  const product = itemFor === "shop:products" ? sources.sampleProducts?.[0] : undefined;
  return {
    site,
    lists,
    productLists,
    item: itemFor && !product ? samplesOf(itemFor)[0] : undefined,
    product,
    products: Object.fromEntries(
      (sources.sampleProducts ?? []).map((sample) => [sample.handle, sample]),
    ),
    forms: Object.fromEntries((sources.sampleForms ?? []).map((form) => [form.handle, form])),
    credits: sources.photoCredits,
  };
}
