import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  checkStripeConnection,
  createMarket,
  createShippingRate,
  createShippingZone,
  deleteMarket,
  deleteShippingRate,
  deleteShippingZone,
  disconnectStripe,
  getPaymentSettings,
  getTaxSettings,
  listMarkets,
  listShippingZones,
  type MarketInput,
  type PaymentKeys,
  savePaymentKeys,
  type ShippingRateInput,
  type TaxSettings,
  updateMarket,
  updateShippingRate,
  updateShippingZone,
  updateTaxSettings,
} from "./shopSettings.api.js";

/** TanStack Query hooks for Shop → Settings. */

export const shopSettingsKeys = {
  markets: () => ["shop", "settings", "markets"] as const,
  shipping: () => ["shop", "settings", "shipping"] as const,
  taxes: () => ["shop", "settings", "taxes"] as const,
  payments: () => ["shop", "settings", "payments"] as const,
};

export function useMarkets() {
  return useQuery({ queryKey: shopSettingsKeys.markets(), queryFn: listMarkets });
}

/** The market whose currency is the shop's own, once there is one. */
export function usePrimaryCurrency(): string | null {
  const markets = useMarkets();
  return (
    markets.data?.find((market) => market.isPrimary)?.currency ??
    markets.data?.[0]?.currency ??
    null
  );
}

function useInvalidating<Input, Result>(
  queryKey: readonly string[],
  change: (input: Input) => Promise<Result>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export function useSaveMarket(marketId: string | null) {
  return useInvalidating(shopSettingsKeys.markets(), (market: MarketInput) =>
    marketId ? updateMarket(marketId, market) : createMarket(market),
  );
}

export function useMakeMarketPrimary() {
  return useInvalidating(shopSettingsKeys.markets(), (marketId: string) =>
    updateMarket(marketId, { isPrimary: true }),
  );
}

export function useDeleteMarket() {
  return useInvalidating(shopSettingsKeys.markets(), deleteMarket);
}

export function useShippingZones() {
  return useQuery({ queryKey: shopSettingsKeys.shipping(), queryFn: listShippingZones });
}

export function useSaveShippingZone(zoneId: string | null) {
  return useInvalidating(
    shopSettingsKeys.shipping(),
    (zone: { name: string; countries: string[] }) =>
      zoneId ? updateShippingZone(zoneId, zone) : createShippingZone(zone),
  );
}

export function useDeleteShippingZone() {
  return useInvalidating(shopSettingsKeys.shipping(), deleteShippingZone);
}

export function useSaveShippingRate(zoneId: string, rateId: string | null) {
  return useInvalidating(shopSettingsKeys.shipping(), (rate: ShippingRateInput) =>
    rateId ? updateShippingRate(rateId, rate) : createShippingRate(zoneId, rate),
  );
}

export function useDeleteShippingRate() {
  return useInvalidating(shopSettingsKeys.shipping(), deleteShippingRate);
}

export function useTaxSettings() {
  return useQuery({ queryKey: shopSettingsKeys.taxes(), queryFn: getTaxSettings });
}

export function useUpdateTaxSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: Partial<Omit<TaxSettings, "effectiveCalculation">>) =>
      updateTaxSettings(changes),
    onSuccess: (settings) => queryClient.setQueryData(shopSettingsKeys.taxes(), settings),
  });
}

export function usePaymentSettings() {
  return useQuery({ queryKey: shopSettingsKeys.payments(), queryFn: getPaymentSettings });
}

export function useSavePaymentKeys() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keys: PaymentKeys) => savePaymentKeys(keys),
    onSuccess: (settings) => {
      queryClient.setQueryData(shopSettingsKeys.payments(), settings);
      return queryClient.invalidateQueries({ queryKey: shopSettingsKeys.taxes() });
    },
  });
}

export function useDisconnectStripe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectStripe,
    onSuccess: (settings) => queryClient.setQueryData(shopSettingsKeys.payments(), settings),
  });
}

export function useCheckStripeConnection() {
  return useMutation({ mutationFn: checkStripeConnection });
}
