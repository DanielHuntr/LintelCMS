import { apiRequest } from "../api/client.js";
import type { Money } from "./money.js";

/** Calls to the shop's order, customer and sales routes (packages/core/src/commerce). */

export type OrderStatus =
  "paid" | "partially_refunded" | "refunded" | "partially_fulfilled" | "fulfilled" | "cancelled";

export interface Address {
  name: string;
  company: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
}

export interface OrderSummary {
  id: string;
  number: number;
  name: string;
  email: string;
  customerName: string;
  status: OrderStatus;
  paymentStatus: "paid" | "partially_refunded" | "refunded";
  fulfilmentStatus: "unfulfilled" | "partially_fulfilled" | "fulfilled";
  cancelled: boolean;
  total: Money;
  itemCount: number;
  createdAt: string;
}

export interface OrderLine {
  id: string;
  productId: string | null;
  variantId: string | null;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  imageId: string | null;
  quantity: number;
  unitPrice: Money;
  subtotal: Money;
  discount: Money;
  tax: Money;
  fulfilledQuantity: number;
  refundedQuantity: number;
  unfulfilledQuantity: number;
}

export interface Order extends OrderSummary {
  customerId: string | null;
  shippingAddress: Address;
  shippingLine: { name: string; amount: Money };
  subtotal: Money;
  discount: Money;
  shipping: Money;
  tax: Money;
  refunded: Money;
  taxesIncluded: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  refundable: Money;
  lines: OrderLine[];
  refunds: Array<{ id: string; amount: Money; status: string; reason: string; createdAt: string }>;
  fulfilments: Array<{
    id: string;
    lines: Array<{ orderLineId: string; quantity: number }>;
    trackingCompany: string;
    trackingNumber: string;
    trackingUrl: string;
    createdAt: string;
  }>;
  timeline: Array<{ id: string; kind: string; message: string; createdAt: string }>;
  stripePaymentUrl: string | null;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone: string;
  note: string;
  addresses: Address[];
  orderCount: number;
  totalSpent: Money[];
  createdAt: string;
}

export interface SalesSummary {
  days: number;
  primaryCurrency: string | null;
  byCurrency: Array<{ currency: string; sales: Money; orderCount: number; averageOrder: Money }>;
  daily: Array<{ date: string; sales: Money; orderCount: number }>;
  ordersToFulfil: number;
}

export type OrderFilter = "all" | "unfulfilled" | "fulfilled" | "refunded";

export function listOrders(
  filter: { view?: OrderFilter; search?: string; customerId?: string } = {},
) {
  const parameters = new URLSearchParams({ perPage: "100" });
  if (filter.search) parameters.set("search", filter.search);
  if (filter.customerId) parameters.set("customerId", filter.customerId);
  if (filter.view === "unfulfilled") {
    parameters.set("fulfilmentStatus", "unfulfilled");
    parameters.set("cancelled", "false");
  }
  if (filter.view === "fulfilled") parameters.set("fulfilmentStatus", "fulfilled");
  if (filter.view === "refunded") parameters.set("paymentStatus", "refunded");
  return apiRequest<{ items: OrderSummary[]; total: number }>(`/shop/orders?${parameters}`);
}

export function getOrder(orderId: string) {
  return apiRequest<Order>(`/shop/orders/${encodeURIComponent(orderId)}`);
}

export interface RefundInput {
  amount?: number;
  lines: Array<{ orderLineId: string; quantity: number }>;
  reason: string;
  restock: boolean;
  notifyCustomer: boolean;
}

export function refundOrder(orderId: string, refund: RefundInput) {
  return apiRequest<Order>(`/shop/orders/${encodeURIComponent(orderId)}/refunds`, {
    method: "POST",
    body: refund,
  });
}

export interface FulfilmentInput {
  lines: Array<{ orderLineId: string; quantity: number }>;
  trackingCompany: string;
  trackingNumber: string;
  trackingUrl: string;
  notifyCustomer: boolean;
}

export function fulfilOrder(orderId: string, fulfilment: FulfilmentInput) {
  return apiRequest<Order>(`/shop/orders/${encodeURIComponent(orderId)}/fulfilments`, {
    method: "POST",
    body: fulfilment,
  });
}

export function cancelOrder(
  orderId: string,
  cancel: { reason: string; refund: boolean; restock: boolean },
) {
  return apiRequest<Order>(`/shop/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    body: cancel,
  });
}

export function addOrderNote(orderId: string, message: string) {
  return apiRequest<Order>(`/shop/orders/${encodeURIComponent(orderId)}/notes`, {
    method: "POST",
    body: { message },
  });
}

export function listCustomers(search?: string) {
  const parameters = new URLSearchParams({ perPage: "100" });
  if (search) parameters.set("search", search);
  return apiRequest<{ items: Customer[]; total: number }>(`/shop/customers?${parameters}`);
}

export function getCustomer(customerId: string) {
  return apiRequest<Customer>(`/shop/customers/${encodeURIComponent(customerId)}`);
}

export function updateCustomer(
  customerId: string,
  changes: { note?: string; name?: string; phone?: string },
) {
  return apiRequest<Customer>(`/shop/customers/${encodeURIComponent(customerId)}`, {
    method: "PATCH",
    body: changes,
  });
}

export function getSalesSummary(days = 30) {
  return apiRequest<SalesSummary>(`/shop/sales/summary?days=${days}`);
}
