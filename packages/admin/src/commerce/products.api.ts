import { apiRequest } from "../api/client.js";
import type { RichTextDocument } from "../fields/field.types.js";
import type { Money } from "./money.js";

/** Calls to the shop's product, collection and location routes (packages/core/src/commerce). */

export type ProductStatus = "draft" | "active" | "archived";

export interface ProductOption {
  name: string;
  values: string[];
}

export interface VariantPrice {
  currency: string;
  amount: number;
  compareAtAmount: number | null;
}

export interface Variant {
  id: string;
  title: string;
  optionValues: string[];
  sku: string | null;
  barcode: string | null;
  weightGrams: number;
  inventoryTracked: boolean;
  prices: VariantPrice[];
  stock: Array<{ locationId: string; onHand: number }>;
  available: number | null;
  held: number;
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  description: RichTextDocument | null;
  status: ProductStatus;
  vendor: string;
  productType: string;
  tags: string[];
  mediaIds: string[];
  seoTitle: string;
  seoDescription: string;
  options: ProductOption[];
  variants: Variant[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductSummary {
  id: string;
  title: string;
  handle: string;
  status: ProductStatus;
  imageId: string | null;
  variantCount: number;
  available: number | null;
  priceRange: { currency: string; min: number; max: number } | null;
  updatedAt: string;
}

/** What the editor sends: the whole product. A variant without an id is new. */
export interface ProductInput {
  title: string;
  handle?: string;
  description: RichTextDocument | null;
  status: ProductStatus;
  vendor: string;
  productType: string;
  tags: string[];
  mediaIds: string[];
  seoTitle: string;
  seoDescription: string;
  options: ProductOption[];
  variants: Array<{
    id?: string;
    optionValues: string[];
    sku: string | null;
    barcode: string | null;
    weightGrams: number;
    inventoryTracked: boolean;
    prices: VariantPrice[];
    stock: Array<{ locationId: string; onHand: number }>;
  }>;
}

export interface InventoryLocation {
  id: string;
  name: string;
  isActive: boolean;
}

export interface ProductListQuery {
  search?: string;
  status?: ProductStatus;
}

export function listProducts(query: ProductListQuery = {}) {
  const parameters = new URLSearchParams({ perPage: "100" });
  if (query.search) parameters.set("search", query.search);
  if (query.status) parameters.set("status", query.status);
  return apiRequest<{ items: ProductSummary[]; total: number }>(`/shop/products?${parameters}`);
}

export function getProduct(productId: string) {
  return apiRequest<Product>(`/shop/products/${encodeURIComponent(productId)}`);
}

export function createProduct(product: ProductInput) {
  return apiRequest<Product>("/shop/products", { method: "POST", body: product });
}

export function saveProduct(productId: string, product: ProductInput) {
  return apiRequest<Product>(`/shop/products/${encodeURIComponent(productId)}`, {
    method: "PUT",
    body: product,
  });
}

export function deleteProduct(productId: string) {
  return apiRequest<void>(`/shop/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
}

export async function listLocations(): Promise<InventoryLocation[]> {
  const { locations } = await apiRequest<{ locations: InventoryLocation[] }>("/shop/locations");
  return locations;
}

export function priceRangeText(
  range: ProductSummary["priceRange"],
  format: (money: Money) => string,
): string | null {
  if (!range) return null;
  const min = format({ amount: range.min, currency: range.currency });
  return range.min === range.max
    ? min
    : `${min} – ${format({ amount: range.max, currency: range.currency })}`;
}
