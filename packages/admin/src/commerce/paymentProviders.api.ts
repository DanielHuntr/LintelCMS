import { apiRequest } from "../api/client.js";

/** Calls behind PayPal and Mollie in Shop → Settings → Payments, and each market's choice. */

export type PaymentProviderId = "stripe" | "paypal" | "mollie";
type KeySource = "environment" | "admin";

export interface PaymentProviders {
  paypal: {
    connected: boolean;
    mode: "test" | "live" | null;
    source: KeySource | null;
    clientIdHint: string | null;
    webhookIdSet: boolean;
    webhookUrl: string;
    webhookEvents: string[];
  };
  mollie: {
    connected: boolean;
    mode: "test" | "live" | null;
    source: KeySource | null;
    apiKeyHint: string | null;
    webhookUrl: string | null;
  };
  markets: Array<{
    id: string;
    name: string;
    currency: string;
    paymentProvider: PaymentProviderId;
  }>;
}

export interface WayToPay {
  id: string;
  name: string;
  /** Switched on, but the provider hasn't approved it yet. */
  waiting: boolean;
}

export interface ProviderWaysToPay {
  provider: PaymentProviderId;
  mode: "test" | "live" | null;
  /** Null when the provider can't say. */
  methods: WayToPay[] | null;
}

export interface PayPalCredentialsInput {
  clientId: string;
  clientSecret: string;
  webhookId: string | null;
  environment: "sandbox" | "live";
}

export function getPaymentProviders() {
  return apiRequest<PaymentProviders>("/shop/settings/payment-providers");
}

export function getWaysToPay() {
  return apiRequest<{ providers: ProviderWaysToPay[] }>("/shop/settings/ways-to-pay");
}

export function connectPayPal(credentials: PayPalCredentialsInput) {
  return apiRequest<PaymentProviders>("/shop/settings/payment-providers/paypal", {
    method: "PUT",
    body: credentials,
  });
}

export function connectMollie(apiKey: string) {
  return apiRequest<PaymentProviders>("/shop/settings/payment-providers/mollie", {
    method: "PUT",
    body: { apiKey },
  });
}

export function disconnectProvider(provider: "paypal" | "mollie") {
  return apiRequest<PaymentProviders>(`/shop/settings/payment-providers/${provider}`, {
    method: "DELETE",
  });
}

export function chooseMarketProvider(marketId: string, paymentProvider: PaymentProviderId) {
  return apiRequest<unknown>(`/shop/markets/${marketId}`, {
    method: "PATCH",
    body: { paymentProvider },
  });
}
