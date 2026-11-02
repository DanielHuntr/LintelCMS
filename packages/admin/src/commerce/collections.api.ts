import { apiRequest } from "../api/client.js";
import type { ProductCollectionSummary } from "./discounts.api.js";

/** Calls behind Shop → Collections: groups of products, picked by hand or by rules. */

export interface ProductCollectionRule {
  field: string;
  operator: string;
  value: string;
}

export interface ProductCollection extends ProductCollectionSummary {
  description: string;
  rules: ProductCollectionRule[];
  matchAll: boolean;
  /** The products in it, in order. For automatic collections, the ones its rules match. */
  productIds: string[];
}

/** The whole collection, as `POST /shop/collections` and `PUT /shop/collections/:id` take it. */
export interface ProductCollectionInput {
  title: string;
  description: string;
  kind: "manual" | "automatic";
  rules: ProductCollectionRule[];
  matchAll: boolean;
  productIds: string[];
}

export function getProductCollection(collectionId: string) {
  return apiRequest<ProductCollection>(`/shop/collections/${encodeURIComponent(collectionId)}`);
}

export function createProductCollection(collection: ProductCollectionInput) {
  return apiRequest<ProductCollection>("/shop/collections", { method: "POST", body: collection });
}

export function saveProductCollection(collectionId: string, collection: ProductCollectionInput) {
  return apiRequest<ProductCollection>(`/shop/collections/${encodeURIComponent(collectionId)}`, {
    method: "PUT",
    body: collection,
  });
}

/** What to send back to change a collection, keeping everything not being changed. */
export function inputFromCollection(collection: ProductCollection): ProductCollectionInput {
  return {
    title: collection.title,
    description: collection.description,
    kind: collection.kind,
    rules: collection.rules,
    matchAll: collection.matchAll,
    productIds: collection.productIds,
  };
}
