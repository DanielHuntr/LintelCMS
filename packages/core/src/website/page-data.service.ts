import {
  type BoundItem,
  type CollectionListData,
  type DataForm,
  type DataSite,
  findNodesOfType,
  type PageData,
  type PageDocument,
  type PageNode,
  type ProductListData,
  type ShopProduct,
} from "@lintel/builder-model";
import type { MenuItem } from "@lintel/site-components";
import { listDeliveredEntries } from "../delivery/delivery.service.js";
import { TaxonomyNotFoundError, TermNotFoundError } from "../taxonomies/taxonomies.errors.js";
import type { DeliveredEntry } from "../delivery/delivery.schema.js";
import { entryAsItem } from "./bound-entries.js";
import { entryTitle } from "./delivered-to-site.js";
import { localiseUrl } from "./site-chrome.service.js";
import type { PageRequest } from "./site-pages.service.js";
import { noSources } from "./site-sources.js";

/**
 * Loads what a designed page's dynamic elements show, only for the elements it has: each
 * collection list's entries, each product grid's products, the products and forms chosen
 * by handle, and the site's name, menu and languages for headers and footers.
 *
 * `?page=` pages through the first list on the page that links to more pages, and `?sort=`
 * orders its product grids.
 */

export const SITE_API_BASE = "/_lintel/api";

/** The most entries read to sort a list some other way than its collection's own order. */
const SORT_LIMIT = 500;

export interface PageDataOptions {
  item?: BoundItem;
  product?: ShopProduct;
  /** The entry being shown, left out of lists of its collection that ask for it to be. */
  currentEntry?: { id: string; collection: string };
}

export async function loadPageData(
  request: PageRequest,
  document: PageDocument,
  options: PageDataOptions = {},
): Promise<PageData> {
  const paged = findNodesOfType(document.root, ["collectionList", "productGrid"]).find(
    (node) => node.props.paginate === true,
  );
  const lists: Record<string, CollectionListData> = {};
  for (const node of findNodesOfType(document.root, ["collectionList"])) {
    const list = await loadCollectionList(
      request,
      node,
      node === paged ? request.query.page : 1,
      options.currentEntry,
    );
    if (list) lists[node.id] = list;
  }
  const productLists: Record<string, ProductListData> = {};
  for (const node of findNodesOfType(document.root, ["productGrid"])) {
    const list = await loadProductGrid(request, node, node === paged ? request.query.page : 1);
    if (list) productLists[node.id] = list;
  }
  return {
    site: siteData(request),
    item: options.item,
    product: options.product,
    lists,
    productLists,
    products: await loadChosenProducts(request, document),
    forms: await loadForms(request, document),
  };
}

function menuLinks(items: readonly MenuItem[]): DataSite["menu"] {
  return items.map((item) => ({
    label: item.label,
    url: item.url,
    current: item.current,
    children: menuLinks(item.children),
  }));
}

function siteData(request: PageRequest): DataSite {
  const { chrome, context, locale } = request;
  return {
    siteName: chrome.siteName,
    homeUrl: chrome.homeUrl,
    logo: chrome.logo
      ? {
          src: chrome.logo.url,
          alt: chrome.logo.alt,
          width: chrome.logo.width,
          height: chrome.logo.height,
        }
      : null,
    menu: menuLinks(chrome.menu),
    socialLinks: chrome.socialLinks,
    footerText: chrome.footerText,
    languages: context.locales.map((language) => ({
      code: language.code,
      name: language.name,
      url: localiseUrl("/", language.code, context.defaultLocale),
      current: language.code === locale,
    })),
    locale,
    apiBase: SITE_API_BASE,
  };
}

/** `?page=2` on the page's address, keeping anything else it has. */
function pageAddress(
  request: PageRequest,
  page: number,
  extra: Record<string, string> = {},
): string {
  const query = new URLSearchParams(extra);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `${request.path}?${search}` : request.path;
}

function pageLinks(
  request: PageRequest,
  page: number,
  totalPages: number,
  extra: Record<string, string> = {},
) {
  return {
    page,
    totalPages,
    previousUrl: page > 1 ? pageAddress(request, page - 1, extra) : null,
    nextUrl: page < totalPages ? pageAddress(request, page + 1, extra) : null,
  };
}

const compareTitles = (first: DeliveredEntry, second: DeliveredEntry) =>
  entryTitle(first).localeCompare(entryTitle(second), undefined, { sensitivity: "base" });

const newestFirst = (entries: DeliveredEntry[]) =>
  entries.toSorted((first, second) =>
    (second.publishedAt ?? "").localeCompare(first.publishedAt ?? ""),
  );

const sorts: Record<string, (entries: DeliveredEntry[]) => DeliveredEntry[]> = {
  newest: newestFirst,
  oldest: (entries) =>
    entries.toSorted((first, second) =>
      (first.publishedAt ?? "").localeCompare(second.publishedAt ?? ""),
    ),
  titleAToZ: (entries) => entries.toSorted(compareTitles),
  titleZToA: (entries) => entries.toSorted((first, second) => compareTitles(second, first)),
};

async function loadCollectionList(
  request: PageRequest,
  node: PageNode,
  page: number,
  currentEntry: PageDataOptions["currentEntry"],
): Promise<CollectionListData | null> {
  const { dependencies, context, locale } = request;
  const collection = context.collections.find(({ handle }) => handle === node.props.collection);
  if (!collection) return null;
  const limit = Number(node.props.limit) || 6;
  const [taxonomy, term] = String(node.props.term ?? "").split("/");
  const sort = String(node.props.sort ?? "newest");
  // The collection's own order (newest first for dated ones) comes from the database a page
  // at a time; any other order sorts the newest entries here.
  const ownOrder = sort === "manual" || (sort === "newest" && collection.structure === "dated");
  const skip =
    node.props.skipCurrent === true && currentEntry?.collection === collection.handle
      ? currentEntry.id
      : null;
  const read = (pageNumber: number, perPage: number) =>
    listDeliveredEntries(
      dependencies.database,
      collection.handle,
      {
        page: pageNumber,
        perPage,
        locale,
        taxonomy: taxonomy || undefined,
        term: term || undefined,
      },
      dependencies.assetLookup,
    ).catch((error: unknown) => {
      // A filter by a term that has since been deleted shows the list's empty state.
      if (error instanceof TermNotFoundError || error instanceof TaxonomyNotFoundError) {
        return { items: [], total: 0 };
      }
      throw error;
    });
  let entries: DeliveredEntry[];
  let total: number;
  if (ownOrder) {
    const list = await read(page, limit + (skip ? 1 : 0));
    entries = list.items.filter((entry) => entry.id !== skip).slice(0, limit);
    total = list.total - (skip ? 1 : 0);
  } else {
    const everything = await read(1, SORT_LIMIT);
    const sorted = (sorts[sort] ?? newestFirst)(
      everything.items.filter((entry) => entry.id !== skip),
    );
    entries = sorted.slice((page - 1) * limit, page * limit);
    total = sorted.length;
  }
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items: entries.map((entry) =>
      entryAsItem(
        entry,
        localiseUrl(entry.url ?? `/${entry.slug}`, locale, context.defaultLocale),
        locale,
      ),
    ),
    ...pageLinks(request, Math.min(page, totalPages), totalPages),
  };
}

const lowestPrice = (product: ShopProduct) =>
  product.priceRange?.min.amount ?? Number.MAX_SAFE_INTEGER;

const productSorts: Record<string, (products: ShopProduct[]) => ShopProduct[]> = {
  priceLowToHigh: (products) =>
    products.toSorted((first, second) => lowestPrice(first) - lowestPrice(second)),
  priceHighToLow: (products) =>
    products.toSorted((first, second) => lowestPrice(second) - lowestPrice(first)),
  titleAToZ: (products) =>
    products.toSorted((first, second) => first.title.localeCompare(second.title)),
  newest: (products) => products.toReversed(),
};

async function loadProductGrid(
  request: PageRequest,
  node: PageNode,
  page: number,
): Promise<ProductListData | null> {
  const shop = (request.dependencies.sources ?? noSources).shop;
  const limit = Number(node.props.limit) || 12;
  const collection = String(node.props.collection ?? "") || request.shopCollection;
  const sort =
    request.query.sort && request.query.sort in productSorts
      ? request.query.sort
      : String(node.props.sort ?? "featured");
  const sorter = productSorts[sort];
  const answer = sorter
    ? await shop.listProducts({ collection, page: 1, perPage: 100 })
    : await shop.listProducts({ collection, page, perPage: limit });
  if (!answer) return null;
  const products = sorter
    ? sorter(answer.products).slice((page - 1) * limit, page * limit)
    : answer.products;
  const total = sorter ? answer.products.length : answer.total;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const extra: Record<string, string> = sort === node.props.sort ? {} : { sort };
  return {
    products,
    ...pageLinks(request, Math.min(page, totalPages), totalPages, extra),
    sort,
    sortUrls: Object.fromEntries(
      ["featured", "newest", "priceLowToHigh", "priceHighToLow", "titleAToZ"].map((value) => [
        value,
        pageAddress(request, 1, value === node.props.sort ? {} : { sort: value }),
      ]),
    ),
  };
}

const shopElementTypes = [
  "productCard",
  "productGallery",
  "productPrice",
  "variantPicker",
  "addToCart",
];

async function loadChosenProducts(
  request: PageRequest,
  document: PageDocument,
): Promise<Record<string, ShopProduct>> {
  const shop = (request.dependencies.sources ?? noSources).shop;
  const handles = new Set(
    findNodesOfType(document.root, shopElementTypes)
      .map((node) => String(node.props.product ?? ""))
      .filter(Boolean),
  );
  const products: Record<string, ShopProduct> = {};
  for (const handle of handles) {
    const product = await shop.findProduct(handle);
    if (product) products[handle] = product;
  }
  return products;
}

async function loadForms(
  request: PageRequest,
  document: PageDocument,
): Promise<Record<string, DataForm>> {
  const source = (request.dependencies.sources ?? noSources).forms;
  const handles = new Set(
    findNodesOfType(document.root, ["formEmbed", "newsletterSignup"])
      .map((node) => String(node.props.form ?? ""))
      .filter(Boolean),
  );
  const forms: Record<string, DataForm> = {};
  for (const handle of handles) {
    const form = await source.findForm(handle);
    if (form) forms[handle] = form;
  }
  return forms;
}
