import { apiRequest } from "../api/client.js";

/** Calls behind Shop → Discounts, and the collections a discount can be for. */

export type DiscountMethod = "code" | "automatic";
export type DiscountKind = "percentage" | "fixed_amount" | "free_shipping" | "buy_x_get_y";
export type DiscountScope = "order" | "products" | "collections";
export type DiscountStatus = "active" | "scheduled" | "expired" | "used_up" | "off";

export interface DiscountInput {
  title: string;
  method: DiscountMethod;
  code: string | null;
  kind: DiscountKind;
  percentOff?: number;
  amounts: Record<string, number>;
  buyQuantity: number;
  getQuantity: number;
  scope: DiscountScope;
  productIds: string[];
  collectionIds: string[];
  minimumSpend: Record<string, number>;
  minimumQuantity: number | null;
  startsAt: string;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  combinesWithOthers: boolean;
  enabled: boolean;
}

export interface Discount extends Omit<DiscountInput, "percentOff"> {
  id: string;
  percentOff: number;
  status: DiscountStatus;
  usageCount: number;
  createdAt: string;
}

export interface ProductCollectionSummary {
  id: string;
  title: string;
  handle: string;
  kind: "manual" | "automatic";
  productCount: number;
}

export async function listDiscounts(): Promise<Discount[]> {
  return (await apiRequest<{ discounts: Discount[] }>("/shop/discounts")).discounts;
}

export function getDiscount(discountId: string) {
  return apiRequest<Discount>(`/shop/discounts/${discountId}`);
}

export function createDiscount(discount: DiscountInput) {
  return apiRequest<Discount>("/shop/discounts", { method: "POST", body: discount });
}

export function saveDiscount(discountId: string, discount: DiscountInput) {
  return apiRequest<Discount>(`/shop/discounts/${discountId}`, { method: "PUT", body: discount });
}

export function deleteDiscount(discountId: string) {
  return apiRequest<void>(`/shop/discounts/${discountId}`, { method: "DELETE" });
}

export async function listProductCollections(): Promise<ProductCollectionSummary[]> {
  return (await apiRequest<{ collections: ProductCollectionSummary[] }>("/shop/collections"))
    .collections;
}
