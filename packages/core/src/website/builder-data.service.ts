import type { DataCollection, DataForm, ShopProduct } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import { findCollectionOrFail } from "../collections/collections.service.js";
import { listDeliveredEntries } from "../delivery/delivery.service.js";
import { deliverTaxonomy } from "../taxonomies/taxonomies-delivery.service.js";
import { bindableFieldsOf, choiceLabelsOf, entryAsItem } from "./bound-entries.js";
import { localiseUrl } from "./site-chrome.service.js";
import { readSiteContext, type SiteDependencies } from "./site-pages.service.js";
import { readForm, readStorefrontProduct } from "./site-sources.js";

/**
 * What the page builder offers to show: the site's collections (with their fields, the
 * terms to filter by and three sample entries for the canvas), its forms and its products.
 * Forms and products come from their plugins' APIs, asked with the editor's own session, so
 * they are simply empty while a plugin is off.
 */

export interface BuilderData {
  collections: DataCollection[];
  forms: Array<{ value: string; label: string }>;
  products: Array<{ value: string; label: string }>;
  productCollections: Array<{ value: string; label: string }>;
  sampleProducts: ShopProduct[];
  /** Every form, as a page draws it, so a Form element on the canvas shows the real form. */
  sampleForms: DataForm[];
}

const SAMPLES = 3;

export async function readBuilderData(
  server: FastifyInstance,
  dependencies: SiteDependencies,
  sessionHeaders: Record<string, string>,
): Promise<BuilderData> {
  const context = await readSiteContext(dependencies);
  const collections = await Promise.all(
    context.listedCollections.map(async (routed): Promise<DataCollection> => {
      const collection = await findCollectionOrFail(dependencies.database, routed.handle);
      const blueprint = await findBlueprintByIdOrFail(
        dependencies.database,
        collection.blueprintId,
      );
      const samples = await listDeliveredEntries(
        dependencies.database,
        routed.handle,
        { page: 1, perPage: SAMPLES, locale: context.defaultLocale },
        dependencies.assetLookup,
        dependencies.site,
      );
      const terms = await Promise.all(
        routed.taxonomyHandles.map(async (taxonomyHandle) => {
          const taxonomy = await deliverTaxonomy(
            dependencies.database,
            taxonomyHandle,
            dependencies.site,
          ).catch(() => null);
          return (taxonomy?.items ?? []).map((term) => ({
            value: `${taxonomyHandle}/${term.slug}`,
            label: `${taxonomy?.name ?? taxonomyHandle}: ${term.title}`,
          }));
        }),
      );
      return {
        handle: routed.handle,
        name: routed.name,
        fields: bindableFieldsOf(blueprint.fields),
        terms: terms.flat(),
        samples: samples.items.map((entry) =>
          entryAsItem(
            entry,
            routed.routePattern === null
              ? ""
              : localiseUrl(entry.url ?? `/${entry.slug}`, entry.locale, context),
            context.defaultLocale,
            choiceLabelsOf(blueprint.fields),
          ),
        ),
      };
    }),
  );
  const ask = async (url: string): Promise<Record<string, unknown> | null> => {
    const response = await server.inject({
      method: "GET",
      url,
      headers: { accept: "application/json", ...sessionHeaders },
    });
    return response.statusCode === 200 ? response.json<Record<string, unknown>>() : null;
  };
  const listOf = (
    answer: Record<string, unknown> | null,
    ...keys: string[]
  ): Record<string, unknown>[] => {
    for (const key of keys) {
      const value = answer?.[key];
      if (Array.isArray(value)) return value as Record<string, unknown>[];
    }
    return [];
  };
  const [forms, products, productCollections] = await Promise.all([
    ask("/forms"),
    ask("/delivery/shop/products?perPage=50"),
    ask("/delivery/shop/collections"),
  ]);
  const sampleProducts = listOf(products, "items").flatMap(
    (item) => readStorefrontProduct(item) ?? [],
  );
  const choice = (item: Record<string, unknown>, label: string) => ({
    value: String(item.handle ?? ""),
    label: String(item[label] ?? item.handle ?? ""),
  });
  return {
    collections,
    forms: listOf(forms, "items", "forms")
      .map((form) => choice(form, "name"))
      .filter((form) => form.value),
    products: sampleProducts.map((product) => ({ value: product.handle, label: product.title })),
    productCollections: listOf(productCollections, "items")
      .map((item) => choice(item, "title"))
      .filter((item) => item.value),
    sampleProducts: sampleProducts.slice(0, 8),
    sampleForms: listOf(forms, "items", "forms").flatMap((item) => {
      const form = readForm(item);
      // Step dividers split a form into pages; the website's delivery API leaves them out too.
      return form
        ? [{ ...form, fields: form.fields.filter((field) => field.type !== "step") }]
        : [];
    }),
  };
}
