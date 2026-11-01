import type { ShopContext } from "../commerce.context.js";
import { molliePaymentProvider } from "./mollie/mollie-provider.js";
import type { PaymentProvider, PaymentProviderId } from "./payment-provider.js";
import { payPalPaymentProvider } from "./paypal/paypal-provider.js";
import { stripePaymentProvider } from "./stripe-provider.js";

/** Every payment provider the shop knows, in one visible list. */
export function paymentProviderFor(shop: ShopContext, id: PaymentProviderId): PaymentProvider {
  switch (id) {
    case "stripe":
      return stripePaymentProvider(shop);
    case "paypal":
      return payPalPaymentProvider(shop);
    case "mollie":
      return molliePaymentProvider(shop);
  }
}
