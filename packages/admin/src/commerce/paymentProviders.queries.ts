import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  chooseMarketProvider,
  connectMollie,
  connectPayPal,
  disconnectProvider,
  getPaymentProviders,
  getWaysToPay,
  type PaymentProviderId,
} from "./paymentProviders.api.js";
import { shopSettingsKeys } from "./shopSettings.queries.js";

/** TanStack Query hooks for PayPal, Mollie and which market pays with which. */

const providersKey = ["shop", "settings", "payment-providers"] as const;
/** Under `providersKey`, so connecting or disconnecting a provider reads it again. */
const waysToPayKey = [...providersKey, "ways-to-pay"] as const;

export function usePaymentProviders() {
  return useQuery({ queryKey: providersKey, queryFn: getPaymentProviders });
}

/**
 * Each read asks the providers themselves, so it isn't repeated on every visit. Stripe's keys
 * are saved through the shop's settings, so its key is part of what's asked for.
 */
export function useWaysToPay(stripeKeyHint: string | undefined) {
  return useQuery({
    queryKey: [...waysToPayKey, stripeKeyHint],
    queryFn: getWaysToPay,
    staleTime: 60_000,
  });
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
