import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  chooseMarketProvider,
  connectMollie,
  connectPayPal,
  disconnectProvider,
  getPaymentProviders,
  type PaymentProviderId,
} from "./paymentProviders.api.js";
import { shopSettingsKeys } from "./shopSettings.queries.js";

/** TanStack Query hooks for PayPal, Mollie and which market pays with which. */

const providersKey = ["shop", "settings", "payment-providers"] as const;

export function usePaymentProviders() {
  return useQuery({ queryKey: providersKey, queryFn: getPaymentProviders });
}

function useSettingProviders<Input>(change: (input: Input) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: providersKey });
      await queryClient.invalidateQueries({ queryKey: shopSettingsKeys.markets() });
    },
  });
}

export function useConnectPayPal() {
  return useSettingProviders(connectPayPal);
}

export function useConnectMollie() {
  return useSettingProviders(connectMollie);
}

export function useDisconnectProvider() {
  return useSettingProviders(disconnectProvider);
}

export function useChooseMarketProvider() {
  return useSettingProviders(
    ({ marketId, provider }: { marketId: string; provider: PaymentProviderId }) =>
      chooseMarketProvider(marketId, provider),
  );
}
