import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import type { ActiveDatabase } from "../../database/active-database.js";
import type { Database } from "../../database/client.js";
import type { ServerOptions } from "../../server.js";
import { setEnabledPlugins } from "../../plugins/plugins.service.js";
import { startTestServer } from "../../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../../testing/test-users.js";
import type { CommerceOptions } from "../commerce.context.js";
import { FakeMollie } from "./fake-mollie.js";
import { FakePayPal, payPalWebhookRequest } from "./fake-paypal.js";
import { FAKE_STRIPE_ENVIRONMENT, FakeStripe, signedStripeWebhook } from "./fake-stripe.js";

/**
 * A server with the shop switched on, Stripe, PayPal and Mollie faked, a clock tests can
 * move, and an admin signed in. Each `useTestDatabase` test builds one in beforeEach.
 */
export interface TestShop {
  server: FastifyInstance;
  stripe: FakeStripe;
  paypal: FakePayPal;
  mollie: FakeMollie;
  clock: { now: Date; advanceMinutes(minutes: number): void };
  admin: (method: Method, url: string, payload?: unknown) => Promise<LightMyRequestResponse>;
  storefront: (method: Method, url: string, payload?: unknown) => Promise<LightMyRequestResponse>;
  sendWebhook(event: {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  }): Promise<LightMyRequestResponse>;
  sendPayPalWebhook(
    event: { id: string; event_type: string; resource: Record<string, unknown> },
    signature?: string,
  ): Promise<LightMyRequestResponse>;
  /** What Mollie sends: only the payment's id, form-encoded. */
  sendMollieWebhook(paymentId: string): Promise<LightMyRequestResponse>;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function startTestShop(
  database: Database,
  activeDatabase: ActiveDatabase,
  options: Partial<CommerceOptions> = {},
  serverOptions: Partial<ServerOptions> = {},
): Promise<TestShop> {
  const stripe = new FakeStripe();
  const paypal = new FakePayPal();
  const mollie = new FakeMollie();
  const paymentFetch: typeof fetch = (input, init) =>
    new URL(String(input)).hostname.includes("paypal")
      ? paypal.fetch(input, init)
      : mollie.fetch(input, init);
  const clock = {
    now: new Date("2026-11-01T10:00:00Z"),
    advanceMinutes(minutes: number) {
      clock.now = new Date(clock.now.getTime() + minutes * 60_000);
    },
  };
  const server = await startTestServer(activeDatabase, {
    ...serverOptions,
    commerce: {
      stripeFetch: stripe.fetch,
      paymentFetch,
      environment: FAKE_STRIPE_ENVIRONMENT,
      now: () => clock.now,
      runScheduledJobs: false,
      ...options,
    },
  });
  await setEnabledPlugins(database, ["commerce"]);
  await createTestUser(database, "owner@example.com", [["*"]]);
  const cookies = await signInAndGetCookies(server, "owner@example.com");

  const send =
    (extra: Partial<InjectOptions>) => (method: Method, url: string, payload?: unknown) =>
      server.inject({
        method,
        url,
        ...extra,
        ...(payload === undefined ? {} : { payload: payload as InjectOptions["payload"] }),
      });

  return {
    server,
    stripe,
    paypal,
    mollie,
    clock,
    admin: send({ cookies }),
    storefront: send({}),
    sendWebhook: (event) => {
      const { payload, headers } = signedStripeWebhook(event, clock.now);
      return server.inject({ method: "POST", url: "/shop/stripe/webhook", payload, headers });
    },
    sendPayPalWebhook: (event, signature) => {
      const { payload, headers } = payPalWebhookRequest(event, signature);
      return server.inject({ method: "POST", url: "/shop/paypal/webhook", payload, headers });
    },
    sendMollieWebhook: (paymentId) =>
      server.inject({
        method: "POST",
        url: "/shop/mollie/webhook",
        payload: `id=${encodeURIComponent(paymentId)}`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
  };
}

/** A UK market in pounds, a shipping zone with a flat rate, and one product with stock. */
export async function stockTheShop(
  shop: TestShop,
  product: { stock?: number; price?: number; tracked?: boolean } = {},
) {
  const market = await shop.admin("POST", "/shop/markets", {
    name: "United Kingdom",
    currency: "GBP",
    countries: ["GB"],
    pricesIncludeTax: false,
  });
  const zone = await shop.admin("POST", "/shop/shipping/zones", { name: "UK", countries: ["GB"] });
  const withRate = await shop.admin("POST", `/shop/shipping/zones/${zone.json().id}/rates`, {
    name: "Standard",
    kind: "flat",
    amounts: { GBP: 495 },
    freeOverAmounts: { GBP: 10_000 },
    deliveryEstimate: "2 to 3 working days",
  });
  const locations = await shop.admin("GET", "/shop/locations");
  const locationId: string = locations.json().locations[0].id;
  const created = await shop.admin("POST", "/shop/products", {
    title: "Linen shirt",
    status: "active",
    options: [{ name: "Size", values: ["M", "L"] }],
    variants: [
      {
        optionValues: ["M"],
        sku: "SHIRT-M",
        weightGrams: 300,
        inventoryTracked: product.tracked ?? true,
        prices: [{ currency: "GBP", amount: product.price ?? 4500 }],
        stock: [{ locationId, onHand: product.stock ?? 5 }],
      },
      {
        optionValues: ["L"],
        sku: "SHIRT-L",
        weightGrams: 320,
        prices: [{ currency: "GBP", amount: product.price ?? 4500 }],
        stock: [{ locationId, onHand: 0 }],
      },
    ],
  });
  if (created.statusCode !== 201) {
    throw new Error(`Creating the test product failed: ${created.body}`);
  }
  return {
    market: market.json(),
    rateId: withRate.json().rates[0].id as string,
    locationId,
    product: created.json(),
    variantId: created.json().variants[0].id as string,
  };
}

export const DELIVERY_ADDRESS = {
  name: "Ada Lovelace",
  line1: "12 St James's Square",
  city: "London",
  postalCode: "SW1Y 4JH",
  country: "GB",
};

/** A cart with `quantity` of the variant, an email, an address and the shipping rate. */
export async function fillCart(shop: TestShop, variantId: string, rateId: string, quantity = 1) {
  const created = await shop.storefront("POST", "/delivery/shop/carts", { country: "GB" });
  const token: string = created.json().token;
  await shop.storefront("POST", `/delivery/shop/carts/${token}/lines`, { variantId, quantity });
  const updated = await shop.storefront("PATCH", `/delivery/shop/carts/${token}`, {
    email: "Ada@Example.com",
    shippingAddress: DELIVERY_ADDRESS,
    shippingRateId: rateId,
  });
  return { token, cart: updated.json() };
}

export const CHECKOUT_PAGES = {
  successUrl: "https://shop.example.com/thanks",
  cancelUrl: "https://shop.example.com/cart",
};
