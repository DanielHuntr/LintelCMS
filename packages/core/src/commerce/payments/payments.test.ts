import { afterEach, describe, expect, it } from "vitest";
import { setEnabledPlugins } from "../../plugins/plugins.service.js";
import { useTestDatabase } from "../../testing/test-database.js";
import { expireAbandonedCheckouts } from "../checkouts/checkout-expiry.js";
import { createShopContext } from "../commerce.context.js";
import { FAKE_STRIPE_ENVIRONMENT } from "../testing/fake-stripe.js";
import {
  CHECKOUT_PAGES,
  fillCart,
  startTestShop,
  stockTheShop,
  type TestShop,
} from "../testing/test-shop.js";

const SLOW_TEST = 60_000;

describe("payments", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop | undefined;
  afterEach(() => shop?.server.close());

  async function start(environment: Record<string, string> = FAKE_STRIPE_ENVIRONMENT) {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase, { environment });
    return shop;
  }

  function paymentSucceeded(checkoutId: string, amount: number, id = "evt_pi_1") {
    return {
      id,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_test_embedded",
          status: "succeeded",
          amount_received: amount,
          currency: "gbp",
          metadata: { lintel_checkout_id: checkoutId },
        },
      },
    };
  }

  it(
    "connects Stripe from pasted keys, checking each one",
    async () => {
      const current = await start({});
      const before = await current.admin("GET", "/shop/settings/payments");
      expect(before.json()).toMatchObject({
        connected: false,
        secretKey: null,
        webhookUrl: "http://localhost:4000/shop/stripe/webhook",
      });
      expect(before.json().webhookEvents).toContain("checkout.session.completed");

      const wrongKey = await current.admin("PUT", "/shop/settings/payments", {
        secretKey: FAKE_STRIPE_ENVIRONMENT.STRIPE_PUBLISHABLE_KEY,
      });
      expect(wrongKey.statusCode).toBe(400);
      expect(wrongKey.json().message).toContain("isn't a secret key");

      const refused = await current.admin("PUT", "/shop/settings/payments", {
        secretKey: "sk_test_notarealkey",
      });
      expect(refused.statusCode).toBe(502);
      expect(refused.json().message).toContain("didn't accept that secret key");

      const saved = await current.admin("PUT", "/shop/settings/payments", {
        secretKey: FAKE_STRIPE_ENVIRONMENT.STRIPE_SECRET_KEY,
        publishableKey: FAKE_STRIPE_ENVIRONMENT.STRIPE_PUBLISHABLE_KEY,
        webhookSecret: FAKE_STRIPE_ENVIRONMENT.STRIPE_WEBHOOK_SECRET,
      });
      expect(saved.statusCode).toBe(200);
      expect(saved.json()).toMatchObject({
        connected: true,
        mode: "test",
        secretKey: { hint: "sk_test_…4242", source: "admin" },
        publishableKey: { value: "pk_test_fakekey4242", source: "admin" },
      });
      expect(saved.body).not.toContain(FAKE_STRIPE_ENVIRONMENT.STRIPE_SECRET_KEY);

      const check = await current.admin("POST", "/shop/settings/payments/check");
      expect(check.json()).toEqual({
        accountId: "acct_test123",
        accountName: "Test shop",
        mode: "test",
      });

      const disconnected = await current.admin("DELETE", "/shop/settings/payments");
      expect(disconnected.json().connected).toBe(false);
    },
    SLOW_TEST,
  );

  it(
    "won't start a checkout before Stripe is connected",
    async () => {
      const current = await start({});
      const { variantId, rateId } = await stockTheShop(current);
      const { token } = await fillCart(current, variantId, rateId);
      const started = await current.storefront(
        "POST",
        `/delivery/shop/carts/${token}/checkout`,
        CHECKOUT_PAGES,
      );
      expect(started.statusCode).toBe(409);
      // Shoppers get a plain sentence, not the owner's set-up instructions (LINTEL-LEFT-002).
      expect(started.json()).toMatchObject({
        code: "SHOP_NOT_READY",
        message: "This shop isn't taking orders yet.",
      });
      expect(started.body).not.toMatch(/Stripe|Settings/);
    },
    SLOW_TEST,
  );

  it(
    "takes payment with the Payment Element, and holds back a payment that doesn't match",
    async () => {
      const current = await start();
      await current.admin("PUT", "/shop/settings/payments", { checkoutMode: "embedded" });
      const { variantId, rateId } = await stockTheShop(current);
      const { token } = await fillCart(current, variantId, rateId);
      const started = await current.storefront(
        "POST",
        `/delivery/shop/carts/${token}/checkout`,
        {},
      );
      expect(started.statusCode).toBe(201);
      const checkout = started.json();
      expect(checkout).toMatchObject({
        mode: "embedded",
        url: null,
        publishableKey: "pk_test_fakekey4242",
      });
      expect(checkout.clientSecret).toMatch(/^pi_test_\d+_secret_/);
      const [intent] = current.stripe.requestsTo("/v1/payment_intents");
      expect(intent?.form.get("amount")).toBe(String(checkout.total.amount));

      await current.sendWebhook(paymentSucceeded(checkout.checkoutId, checkout.total.amount - 1));
      const status = await current.storefront(
        "GET",
        `/delivery/shop/checkouts/${checkout.checkoutId}`,
      );
      expect(status.json()).toMatchObject({ status: "needs_review", orderName: null });
      expect((await current.admin("GET", "/shop/orders")).json().total).toBe(0);
    },
    SLOW_TEST,
  );

  it(
    "still honours a payment that arrives after the stock was released, and says so",
    async () => {
      const current = await start();
      await current.admin("PUT", "/shop/settings/payments", { checkoutMode: "embedded" });
      const { variantId, rateId } = await stockTheShop(current, { stock: 1 });
      const { token } = await fillCart(current, variantId, rateId);
      const checkout = (
        await current.storefront("POST", `/delivery/shop/carts/${token}/checkout`, {})
      ).json();

      current.clock.advanceMinutes(40);
      await expireAbandonedCheckouts(
        createShopContext(current.server, {
          environment: FAKE_STRIPE_ENVIRONMENT,
          stripeFetch: current.stripe.fetch,
          now: () => current.clock.now,
        }),
      );
      expect(current.stripe.requests.some((request) => request.path.endsWith("/cancel"))).toBe(
        true,
      );
      // Someone else buys the last one in the meantime.
      const other = await fillCart(current, variantId, rateId);
      const otherCheckout = (
        await current.storefront("POST", `/delivery/shop/carts/${other.token}/checkout`, {})
      ).json();
      await current.sendWebhook(
        paymentSucceeded(otherCheckout.checkoutId, otherCheckout.total.amount, "evt_other"),
      );

      await current.sendWebhook(
        paymentSucceeded(checkout.checkoutId, checkout.total.amount, "evt_late"),
      );
      const orders = (await current.admin("GET", "/shop/orders")).json();
      expect(orders.total).toBe(2);
      const late = (await current.admin("GET", `/shop/orders/${orders.items[0].id}`)).json();
      expect(late.timeline.map((event: { kind: string }) => event.kind)).toContain("oversold");
    },
    SLOW_TEST,
  );

  it(
    "keeps every shop address closed while the plugin is off",
    async () => {
      const current = await start();
      await setEnabledPlugins(testDatabase.database, current.server.plugins, []);
      for (const url of ["/shop/products", "/delivery/shop/products", "/shop/settings/payments"]) {
        const response = await current.admin("GET", url);
        expect(response.statusCode, url).toBe(404);
        expect(response.json().code).toBe("PLUGIN_NOT_ENABLED");
      }
    },
    SLOW_TEST,
  );

  it(
    "works out tax from manual rates when Stripe Tax isn't used",
    async () => {
      const current = await start();
      const { variantId, rateId, market } = await stockTheShop(current);
      await current.admin("PATCH", `/shop/markets/${market.id}`, { pricesIncludeTax: true });
      await current.admin("PATCH", "/shop/settings/taxes", {
        taxCalculation: "manual",
        manualTaxRates: [{ country: "GB", rate: 20, name: "VAT" }],
      });
      const { token } = await fillCart(current, variantId, rateId, 2);
      const checkout = (
        await current.storefront("POST", `/delivery/shop/carts/${token}/checkout`, CHECKOUT_PAGES)
      ).json();
      // £90 of shirts and £4.95 shipping, VAT included: 1500 + 83.
      expect(checkout).toMatchObject({
        taxesIncluded: true,
        tax: { amount: 1583 },
        total: { amount: 9495 },
      });
      expect(current.stripe.requestsTo("/v1/tax/calculations")).toHaveLength(0);
    },
    SLOW_TEST,
  );
});
