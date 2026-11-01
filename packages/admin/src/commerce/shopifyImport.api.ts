import { apiRequest } from "../api/client.js";

/** Calls behind Shop → Move from Shopify, and the archived orders it brings. */

export type ImportStage = "products" | "collections" | "customers" | "orders" | "done";

export interface ImportOptions {
  productStatus: "keep" | "draft";
  importImages: boolean;
  collectionsFromColumn: boolean;
  tagCollections: string[];
  importCustomers: boolean;
  importOrders: boolean;
  productPathPrefix: string;
}

interface Counts {
  created: number;
  skipped: number;
  failed: number;
}

export interface ImportReport {
  products: Counts;
  collections: Counts;
  customers: Counts;
  orders: Counts;
  images: { downloaded: number; skipped: number };
  problems: Array<{ stage: ImportStage; item: string; message: string }>;
  redirects: Array<{ fromPath: string; toPath: string }>;
}

export type ImportFile = "products" | "customers" | "orders";

export interface ShopifyImport {
  id: string;
  status: "ready" | "importing" | "completed";
  stage: ImportStage;
  done: number;
  total: number;
  paused: boolean;
  currency: string | null;
  files: {
    products: { rows: number };
    customers: { rows: number } | null;
    orders: { rows: number } | null;
  };
  counts: {
    products: number;
    variants: number;
    images: number;
    customers: number;
    orders: number;
    collectionsInFile: string[];
    tags: Array<{ tag: string; products: number }>;
  };
  mapping: Array<{ file: ImportFile; column: string; field: string }>;
  notImported: Array<{ file: string; column: string }>;
  samples: Array<{
    handle: string;
    title: string;
    variants: number;
    images: number;
    price: string;
    status: string;
  }>;
  warnings: string[];
  options: ImportOptions;
  report: ImportReport;
  dryRunReport: ImportReport | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ImportFiles {
  productsCsv: string;
  customersCsv?: string;
  ordersCsv?: string;
}

export interface ArchivedOrder {
  id: string;
  name: string;
  email: string;
  total: { amount: number; currency: string };
  paymentStatus: string;
  fulfilmentStatus: string;
  itemCount: number;
  placedAt: string;
}

export function startShopifyImport(files: ImportFiles) {
  return apiRequest<ShopifyImport>("/shop/imports/shopify", { method: "POST", body: files });
}

export async function listShopifyImports(): Promise<ShopifyImport[]> {
  return (await apiRequest<{ imports: ShopifyImport[] }>("/shop/imports")).imports;
}

export function getShopifyImport(importId: string) {
  return apiRequest<ShopifyImport>(`/shop/imports/${importId}`);
}

export function saveImportOptions(importId: string, options: ImportOptions) {
  return apiRequest<ShopifyImport>(`/shop/imports/${importId}/options`, {
    method: "PUT",
    body: options,
  });
}

export function dryRunShopifyImport(importId: string) {
  return apiRequest<ShopifyImport>(`/shop/imports/${importId}/dry-run`, { method: "POST" });
}

export function runShopifyImportBatch(importId: string) {
  return apiRequest<ShopifyImport>(`/shop/imports/${importId}/run`, { method: "POST", body: {} });
}

export async function listArchivedOrders(customerId: string): Promise<ArchivedOrder[]> {
  const parameters = new URLSearchParams({ customerId, perPage: "50" });
  return (await apiRequest<{ items: ArchivedOrder[] }>(`/shop/archived-orders?${parameters}`))
    .items;
}
