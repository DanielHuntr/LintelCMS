import { type PageDocument, productAsItem, type ShopProduct } from "@lintel/builder-model";
import type { PageView } from "@lintel/site-components";
import { drawPageDesign } from "./designed-pages.js";
import { findItemDesign } from "./item-designs.service.js";
import { loadPageData } from "./page-data.service.js";
import type { SiteResponse } from "./rendered-pages-cache.js";
import { type PageRequest, renderWithHead } from "./site-pages.service.js";
import {
  allProductsDesign,
  cartDesign,
  orderConfirmationDesign,
  productCollectionDesign,
  productDesign,
} from "./shop-designs.js";
import { noSources } from "./site-sources.js";

/**
 * The shop's pages on the built-in website, while the Online shop plugin is on:
 *
 *   /shop                  every product
 *   /shop/<collection>     a collection of products
 *   /products/<handle>     a product
 *   /cart                  the basket, with delivery details and payment
 *   /order-confirmation    where the payment provider sends shoppers back
 *
 * A page the site publishes at the same address wins, so any of them can be designed in
 * the builder. Products use the site's product design when there is one (a page that is the
 * item design for "Products in the shop").
 */
export async function respondToShopPath(request: PageRequest): Promise<SiteResponse | undefined> {
  if (!request.context.shopEnabled) return undefined;
  const shop = (request.dependencies.sources ?? noSources).shop;
  const [, first, second, extra] = request.localPath.split("/");
  if (extra !== undefined) return undefined;
  if (first === "shop" && second === undefined) {
    return renderShopPage(request, allProductsDesign("Shop"), "Shop", "");
  }
  if (first === "shop" && second) {
    const collection = await shop.findCollection(decodeURIComponent(second));
    if (!collection) return undefined;
    return renderShopPage(
      { ...request, shopCollection: collection.handle },
      productCollectionDesign(collection.title, collection.description),
      collection.title,
      collection.description,
    );
  }
  if (first === "products" && second) {
    const product = await shop.findProduct(decodeURIComponent(second));
    if (!product) return undefined;
    return renderProductPage(request, product);
  }
  if (first === "cart" && second === undefined) {
    return renderShopPage(request, cartDesign(), "Your basket", "", { noindex: true });
  }
  if (first === "order-confirmation" && second === undefined) {
    return renderShopPage(request, orderConfirmationDesign(), "Thank you", "", { noindex: true });
  }
  return undefined;
}

async function renderProductPage(
  request: PageRequest,
  product: ShopProduct,
): Promise<SiteResponse> {
  const design = (await findItemDesign(request, "shop:products")) ?? productDesign();
  const item = productAsItem(product, request.locale);
  const summary = typeof item.fields.excerpt === "string" ? item.fields.excerpt : "";
  return renderShopPage(request, design, product.title, summary, { product, item });
}

async function renderShopPage(
  request: PageRequest,
  document: PageDocument,
  title: string,
  description: string,
  options: {
    noindex?: boolean;
    product?: ShopProduct;
    item?: ReturnType<typeof productAsItem>;
  } = {},
): Promise<SiteResponse> {
  const data = await loadPageData(request, document, {
    product: options.product,
    item: options.item,
  });
  const image = options.product?.images[0];
  const view: PageView = {
    kind: "page",
    title,
    summary: description,
    heroImage: null,
    body: "",
    sections: [],
    design: drawPageDesign(document, data),
  };
  return renderWithHead(request, view, {
    entryId: null,
    title,
    description,
    image: image
      ? { url: image.src, alt: image.alt, width: image.width, height: image.height }
      : null,
    path: request.path,
    type: "website",
    publishedAt: null,
    alternates: [],
    noindex: options.noindex,
  });
}
