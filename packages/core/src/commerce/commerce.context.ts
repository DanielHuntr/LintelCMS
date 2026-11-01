import type { FastifyInstance } from "fastify";
import type { Database } from "../database/client.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import type { DiscountProvider } from "./discounts/discount-provider.js";
import { storedDiscounts } from "./discounts/stored-discounts.js";
import type { EmailProvider } from "./emails/email-provider.js";
import { OutboxEmailProvider } from "./emails/outbox-email-provider.js";
import { ShopNotReadyError } from "./commerce.errors.js";
import { StripeClient } from "./payments/stripe-client.js";
import { type Environment, resolveStripeKeys, type StripeKeys } from "./payments/stripe-keys.js";
import { readShopSettingsRow } from "./settings/shop-settings.service.js";

/** How the shop is wired up. Every part has a default; tests replace Stripe and the clock. */
export interface CommerceOptions {
  /** How Stripe is called. Tests pass a fake, so they never touch the network. */
  stripeFetch?: typeof fetch;
  /** Defaults to https://api.stripe.com. */
  stripeApiUrl?: string;
  /** Where the STRIPE_* keys are read from. Defaults to the process environment. */
  environment?: Environment;
  /** How order emails are sent. Defaults to the outbox, readable in the admin. */
  emailProvider?: EmailProvider;
  /** Where discounts come from. Defaults to the ones made in Shop → Discounts. */
  discountProvider?: DiscountProvider;
  /** How PayPal and Mollie are called. Tests pass fakes, so they never touch the network. */
  paymentFetch?: typeof fetch;
  /** Defaults to PayPal's sandbox or live address, as the credentials say. */
  payPalApiUrl?: string;
  /** Defaults to https://api.mollie.com. */
  mollieApiUrl?: string;
  /** How the Shopify importer downloads product photos. Tests pass a fake. */
  importFetch?: typeof fetch;
  /** What time it is, for reservations and webhook signatures. Tests move it on. */
  now?: () => Date;
  /** Release stock held by abandoned checkouts every minute. Off in tests. */
  runScheduledJobs?: boolean;
  /** The API's public address, for the Stripe webhook URL shown in the admin. */
  publicApiUrl?: string;
}

/** What shop services need besides the database, made once when the routes register. */
export interface ShopContext {
  readonly database: Database;
  /** Expands product photos for the storefront, as the delivery API does. */
  readonly assetLookup: AssetLookup;
  readonly emails: EmailProvider;
  readonly discounts: DiscountProvider;
  readonly environment: Environment;
  readonly publicApiUrl: string;
  readonly paymentFetch: typeof fetch;
  readonly payPalApiUrl: string | undefined;
  readonly mollieApiUrl: string | undefined;
  readonly importFetch: typeof fetch;
  now(): Date;
  stripeKeys(): Promise<StripeKeys>;
  /** A client for the configured secret key; a clear error when there isn't one yet. */
  stripe(): Promise<StripeClient>;
  /** Stripe for a key that hasn't been saved yet, for "Check connection". */
  stripeWithKey(secretKey: string): StripeClient;
  log: { error(error: unknown, message: string): void; warn(message: string): void };
}

export function createShopContext(server: FastifyInstance, options: CommerceOptions): ShopContext {
  const environment = options.environment ?? process.env;
  const now = options.now ?? (() => new Date());
  const stripeWithKey = (secretKey: string) =>
    new StripeClient({ secretKey, fetch: options.stripeFetch, apiUrl: options.stripeApiUrl });

  const context: ShopContext = {
    get database() {
      // Read on every use: setup can switch the server to another database.
      return server.database;
    },
    get assetLookup() {
      return server.assetLookup;
    },
    emails: options.emailProvider ?? new OutboxEmailProvider(() => server.database),
    discounts: options.discountProvider ?? storedDiscounts(() => server.database, now),
    environment,
    publicApiUrl: options.publicApiUrl ?? server.publicApiUrl,
    paymentFetch: options.paymentFetch ?? globalThis.fetch,
    payPalApiUrl: options.payPalApiUrl,
    mollieApiUrl: options.mollieApiUrl,
    importFetch: options.importFetch ?? globalThis.fetch,
    now,
    stripeKeys: async () =>
      resolveStripeKeys(await readShopSettingsRow(server.database), environment),
    stripe: async () => {
      const keys = await context.stripeKeys();
      if (!keys.secretKey) {
        throw new ShopNotReadyError(
          "Payments aren't set up yet. Connect Stripe in Shop → Settings → Payments first.",
        );
      }
      return stripeWithKey(keys.secretKey.value);
    },
    stripeWithKey,
    log: {
      error: (error, message) => server.log.error(error, message),
      warn: (message) => server.log.warn(message),
    },
  };
  return context;
}
