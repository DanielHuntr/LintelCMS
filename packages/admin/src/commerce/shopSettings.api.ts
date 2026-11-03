import { apiRequest } from "../api/client.js";

/** Calls behind Shop → Settings: markets, shipping, taxes, payments and the email outbox. */

export type PriceRounding = "exact" | "whole" | "ninety_nine";

export interface Market {
  id: string;
  name: string;
  handle: string;
  currency: string;
  countries: string[];
  isPrimary: boolean;
  exchangeRate: number;
  priceRounding: PriceRounding;
  pricesIncludeTax: boolean;
}

export type MarketInput = Omit<Market, "id" | "handle" | "isPrimary">;

export type AmountsByCurrency = Record<string, number>;

export interface ShippingRate {
  id: string;
  zoneId: string;
  name: string;
  kind: "flat" | "weight";
  amounts: AmountsByCurrency;
  weightBrackets: Array<{ upToGrams: number | null; amounts: AmountsByCurrency }>;
  freeOverAmounts: AmountsByCurrency | null;
  deliveryEstimate: string;
}

export type ShippingRateInput = Omit<ShippingRate, "id" | "zoneId">;

export interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  rates: ShippingRate[];
}

export interface TaxSettings {
  taxCalculation: "stripe" | "manual";
  taxShipping: boolean;
  manualTaxRates: Array<{ country: string; rate: number; name: string }>;
  effectiveCalculation: "stripe" | "manual";
}

export interface PaymentSettings {
  connected: boolean;
  /** The shop is on this computer or a private network, so no webhook can reach it. */
  siteIsLocal: boolean;
  /** Lintel asks Stripe about payments itself, because no webhook is doing it. */
  checksForPayments: boolean;
  mode: "test" | "live" | null;
  secretKey: { hint: string; source: "environment" | "admin" } | null;
  publishableKey: { value: string; source: "environment" | "admin" } | null;
  webhookSecret: { source: "environment" | "admin" } | null;
  webhookUrl: string;
  webhookEvents: string[];
  checkoutMode: "hosted" | "embedded";
}

export interface PaymentKeys {
  secretKey?: string;
  publishableKey?: string;
  webhookSecret?: string;
  checkoutMode?: "hosted" | "embedded";
}

export async function listMarkets(): Promise<Market[]> {
  return (await apiRequest<{ markets: Market[] }>("/shop/markets")).markets;
}

export function createMarket(market: MarketInput) {
  return apiRequest<Market>("/shop/markets", { method: "POST", body: market });
}

export function updateMarket(
  marketId: string,
  changes: Partial<MarketInput> & { isPrimary?: true },
) {
  return apiRequest<Market>(`/shop/markets/${encodeURIComponent(marketId)}`, {
    method: "PATCH",
    body: changes,
  });
}

export function deleteMarket(marketId: string) {
  return apiRequest<void>(`/shop/markets/${encodeURIComponent(marketId)}`, { method: "DELETE" });
}

export async function listShippingZones(): Promise<ShippingZone[]> {
  return (await apiRequest<{ zones: ShippingZone[] }>("/shop/shipping/zones")).zones;
}

export function createShippingZone(zone: { name: string; countries: string[] }) {
  return apiRequest<ShippingZone>("/shop/shipping/zones", { method: "POST", body: zone });
}

export function updateShippingZone(zoneId: string, zone: { name?: string; countries?: string[] }) {
  return apiRequest<ShippingZone>(`/shop/shipping/zones/${encodeURIComponent(zoneId)}`, {
    method: "PATCH",
    body: zone,
  });
}

export function deleteShippingZone(zoneId: string) {
  return apiRequest<void>(`/shop/shipping/zones/${encodeURIComponent(zoneId)}`, {
    method: "DELETE",
  });
}

export function createShippingRate(zoneId: string, rate: ShippingRateInput) {
  return apiRequest<ShippingZone>(`/shop/shipping/zones/${encodeURIComponent(zoneId)}/rates`, {
    method: "POST",
    body: rate,
  });
}

export function updateShippingRate(rateId: string, rate: Partial<ShippingRateInput>) {
  return apiRequest<ShippingZone>(`/shop/shipping/rates/${encodeURIComponent(rateId)}`, {
    method: "PATCH",
    body: rate,
  });
}

export function deleteShippingRate(rateId: string) {
  return apiRequest<void>(`/shop/shipping/rates/${encodeURIComponent(rateId)}`, {
    method: "DELETE",
  });
}

export function getTaxSettings() {
  return apiRequest<TaxSettings>("/shop/settings/taxes");
}

export function updateTaxSettings(changes: Partial<Omit<TaxSettings, "effectiveCalculation">>) {
  return apiRequest<TaxSettings>("/shop/settings/taxes", { method: "PATCH", body: changes });
}

export function getPaymentSettings() {
  return apiRequest<PaymentSettings>("/shop/settings/payments");
}

export function savePaymentKeys(keys: PaymentKeys) {
  return apiRequest<PaymentSettings>("/shop/settings/payments", { method: "PUT", body: keys });
}

export function disconnectStripe() {
  return apiRequest<PaymentSettings>("/shop/settings/payments", { method: "DELETE" });
}

export function checkStripeConnection() {
  return apiRequest<{ accountId: string; accountName: string; mode: "test" | "live" }>(
    "/shop/settings/payments/check",
    { method: "POST" },
  );
}
