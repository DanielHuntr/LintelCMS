import type { ShopContext } from "../commerce.context.js";
import { listMollieMethods } from "./mollie/mollie-api.js";
import { findMollieCredentials, mollieClientFor } from "./mollie/mollie-provider.js";
import { ProviderRequestError } from "./payment-provider.js";
import { readPaymentProviders } from "./payment-providers.service.js";
import { toDecimalAmount } from "./provider-amounts.js";
import { StripeRequestError } from "./stripe-client.js";
import { stripeKeyMode } from "./stripe-keys.js";
import { listStripePaymentMethods } from "./stripe-payment-methods.js";
import type { WaysToPay, WayToPay } from "./ways-to-pay.schema.js";

/**
 * Shop → Settings → Payments, "Ways to pay": what each connected provider says it offers.
 * Lintel leaves the choice of methods to the provider, so this only ever reads. A provider
 * that doesn't answer is reported as unknown, never guessed at.
 */

/** Mollie filters by amount; this stands in for a typical order, 100.00 in most currencies. */
const SAMPLE_ORDER_MINOR_UNITS = 10_000;

export async function readWaysToPay(shop: ShopContext): Promise<WaysToPay> {
  const keys = await shop.stripeKeys();
  const connections = await readPaymentProviders(shop);
  const providers: WaysToPay["providers"] = [];

  const stripeKey = keys.secretKey?.value;
  if (stripeKey) {
    providers.push({
      provider: "stripe",
      mode: stripeKeyMode(stripeKey),
      methods: await readOrNull(shop, "Stripe", () =>
        listStripePaymentMethods(shop.stripeWithKey(stripeKey)),
      ),
    });
  }
  if (connections.paypal.connected) {
    // PayPal has no call that lists what it offers a shop's shoppers.
    providers.push({ provider: "paypal", mode: connections.paypal.mode, methods: null });
  }
  const mollie = await findMollieCredentials(shop);
  if (mollie) {
    const { markets } = connections;
    const usingMollie = markets.filter((market) => market.paymentProvider === "mollie");
    const currencies = (usingMollie.length > 0 ? usingMollie : markets).map(
      (market) => market.currency,
    );
    providers.push({
      provider: "mollie",
      mode: connections.mollie.mode,
      methods: await readOrNull(shop, "Mollie", () =>
        listMollieWays(shop, mollie.apiKey, [...new Set(currencies)]),
      ),
    });
  }
  return { providers };
}

/** Left to itself Mollie lists euro methods only, so it's asked about the shop's currencies. */
async function listMollieWays(
  shop: ShopContext,
  apiKey: string,
  currencies: string[],
): Promise<WayToPay[]> {
  const client = mollieClientFor(shop, apiKey);
  const answers = await Promise.all(
    currencies.map((currency) =>
      listMollieMethods(client, {
        currency,
        value: toDecimalAmount(SAMPLE_ORDER_MINOR_UNITS, currency),
      }),
    ),
  );
  const methods = new Map<string, WayToPay>();
  for (const method of answers.flat()) {
    if (method.status === "rejected") continue;
    const waiting = method.status != null && method.status !== "activated";
    methods.set(method.id, { id: method.id, name: method.description, waiting });
  }
  return [...methods.values()];
}

async function readOrNull(
  shop: ShopContext,
  name: string,
  read: () => Promise<WayToPay[] | null>,
): Promise<WayToPay[] | null> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof StripeRequestError || error instanceof ProviderRequestError) {
      shop.log.warn(`${name} didn't say which ways to pay are on: ${error.message}`);
      return null;
    }
    throw error;
  }
}
