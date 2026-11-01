import type {
  BoundPicture,
  DataForm,
  ShopMoney,
  ShopProduct,
  ShopVariant,
} from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";

/**
 * Where the website reads the shop's products and the forms from: the storefront API
 * (`/delivery/shop`) and the forms API (`/delivery/forms`), asked inside the process with
 * `inject`, so the website depends only on their documented answers. While a plugin is off
 * (or not installed) its API answers 404 and the website shows the elements' empty states.
 */

export interface ShopCollectionSummary {
  handle: string;
  title: string;
  description: string;
}

export interface ShopCatalogue {
  listProducts(query: {
    collection?: string;
    page: number;
    perPage: number;
  }): Promise<{ products: ShopProduct[]; total: number } | null>;
  findProduct(handle: string): Promise<ShopProduct | null>;
  listCollections(): Promise<ShopCollectionSummary[]>;
  findCollection(handle: string): Promise<ShopCollectionSummary | null>;
}

export interface FormsSource {
  findForm(handle: string): Promise<DataForm | null>;
}

export interface SiteSources {
  shop: ShopCatalogue;
  forms: FormsSource;
}

export const noSources: SiteSources = {
  shop: {
    listProducts: async () => null,
    findProduct: async () => null,
    listCollections: async () => [],
    findCollection: async () => null,
  },
  forms: { findForm: async () => null },
};

type Json = Record<string, unknown>;

async function getJson(api: FastifyInstance, url: string): Promise<Json | null> {
  const response = await api.inject({
    method: "GET",
    url,
    headers: { accept: "application/json" },
  });
  if (response.statusCode !== 200) return null;
  try {
    return response.json<Json>();
  } catch {
    return null;
  }
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

function readMoney(value: unknown): ShopMoney | null {
  if (typeof value !== "object" || value === null) return null;
  const { amount, currency } = value as Json;
  return typeof amount === "number" && typeof currency === "string" ? { amount, currency } : null;
}

function readImage(value: unknown): BoundPicture | null {
  if (typeof value !== "object" || value === null) return null;
  const image = value as Json;
  if (typeof image.url !== "string") return null;
  return {
    src: image.url,
    alt: text(image.alt),
    width: typeof image.width === "number" ? image.width : null,
    height: typeof image.height === "number" ? image.height : null,
  };
}

/** A storefront product as the website's elements read it, taking only what they use. */
export function readStorefrontProduct(value: unknown): ShopProduct | null {
  if (typeof value !== "object" || value === null) return null;
  const product = value as Json;
  const handle = text(product.handle);
  if (!handle) return null;
  const range = (product.priceRange ?? null) as Json | null;
  const min = readMoney(range?.min);
  const max = readMoney(range?.max);
  const variants: ShopVariant[] = (Array.isArray(product.variants) ? product.variants : []).map(
    (variant: Json) => ({
      id: text(variant.id),
      title: text(variant.title),
      optionValues: Array.isArray(variant.optionValues) ? variant.optionValues.map(String) : [],
      price: readMoney(variant.price),
      compareAtPrice: readMoney(variant.compareAtPrice),
      availableForSale: variant.availableForSale === true,
    }),
  );
  return {
    id: text(product.id) || handle,
    handle,
    title: text(product.title) || handle,
    descriptionHtml: text(product.descriptionHtml),
    url: `/products/${encodeURIComponent(handle)}`,
    images: (Array.isArray(product.images) ? product.images : []).flatMap(
      (image) => readImage(image) ?? [],
    ),
    options: (Array.isArray(product.options) ? product.options : []).map((option: Json) => ({
      name: text(option.name),
      values: Array.isArray(option.values) ? option.values.map(String) : [],
    })),
    priceRange: min && max ? { min, max } : null,
    availableForSale: product.availableForSale === true,
    variants,
  };
}

function readCollection(value: unknown): ShopCollectionSummary | null {
  if (typeof value !== "object" || value === null) return null;
  const collection = value as Json;
  const handle = text(collection.handle);
  return handle
    ? { handle, title: text(collection.title) || handle, description: text(collection.description) }
    : null;
}

export function storefrontSources(api: FastifyInstance): SiteSources {
  const shop: ShopCatalogue = {
    async listProducts({ collection, page, perPage }) {
      const query = `page=${page}&perPage=${Math.min(100, perPage)}`;
      const answer = collection
        ? await getJson(
            api,
            `/delivery/shop/collections/${encodeURIComponent(collection)}?${query}`,
          )
        : await getJson(api, `/delivery/shop/products?${query}`);
      if (!answer) return null;
      const items = (collection ? answer.products : answer.items) ?? [];
      const products = (Array.isArray(items) ? items : []).flatMap(
        (item) => readStorefrontProduct(item) ?? [],
      );
      return { products, total: typeof answer.total === "number" ? answer.total : products.length };
    },
    async findProduct(handle) {
      return readStorefrontProduct(
        await getJson(api, `/delivery/shop/products/${encodeURIComponent(handle)}`),
      );
    },
    async listCollections() {
      const answer = await getJson(api, "/delivery/shop/collections");
      return (Array.isArray(answer?.items) ? answer.items : []).flatMap(
        (item) => readCollection(item) ?? [],
      );
    },
    async findCollection(handle) {
      return readCollection(
        await getJson(api, `/delivery/shop/collections/${encodeURIComponent(handle)}?perPage=1`),
      );
    },
  };
  const forms: FormsSource = {
    async findForm(handle) {
      return readForm(await getJson(api, `/delivery/forms/${encodeURIComponent(handle)}`));
    },
  };
  return { shop, forms };
}

/** A form from the forms API, with only what drawing it needs. */
export function readForm(value: Json | null): DataForm | null {
  if (!value || typeof value.handle !== "string") return null;
  const protection = (value.spamProtection ?? {}) as Json;
  const confirmation = (value.confirmation ?? {}) as Json;
  return {
    handle: value.handle,
    name: text(value.name),
    submitLabel: text(value.submitLabel) || "Send",
    acceptingSubmissions: value.acceptingSubmissions !== false,
    fields: (Array.isArray(value.fields) ? value.fields : []).map((field: Json) => {
      const options = (field.options ?? {}) as Json;
      return {
        handle: text(field.handle),
        type: text(field.type),
        label: text(field.label),
        helpText: text(field.helpText),
        placeholder: text(field.placeholder),
        required: field.required === true,
        choices: Array.isArray(options.choices) ? options.choices.map(String) : [],
      };
    }),
    spamProtection: {
      honeypotField: text(protection.honeypotField) || "_website",
      tokenField: text(protection.tokenField) || "_token",
      token: text(protection.token),
    },
    confirmationMessage: text(confirmation.message),
  };
}
