import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../../testing/test-database.js";
import { checkoutsTable } from "../checkouts/checkouts.table.js";
import { FAKE_MOLLIE_API_KEY } from "../testing/fake-mollie.js";
import { FAKE_PAYPAL } from "../testing/fake-paypal.js";
import { FAKE_STRIPE_ENVIRONMENT } from "../testing/fake-stripe.js";
import {
  CHECKOUT_PAGES,
  fillCart,
  startTestShop,
  stockTheShop,
  type TestShop,
} from "../testing/test-shop.js";
import { isLocalAddress } from "./local-address.js";
import { checkPayments, newPaymentCheckState } from "./payment-checks.service.js";

const SLOW_TEST = 60_000;
const NO_WEBHOOK_SECRET = {
  STRIPE_SECRET_KEY: FAKE_STRIPE_ENVIRONMENT.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: FAKE_STRIPE_ENVIRONMENT.STRIPE_PUBLISHABLE_KEY,
};

/**
 * A shop no webhook can reach: return confirmation when the shopper comes back, and Lintel's
 * own checks for everything else. Both must agree with the webhook about what happened once.
 */
describe("confirming payments without a webhook", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop | undefined;
  afterEach(() => shop?.server.close());

  async function start(
    environment: Record<string, string> = FAKE_STRIPE_ENVIRONMENT,
    publicApiUrl = "http://localhost:4000",
  ) {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase, {
      environment,
      publicApiUrl,
    });
    const stocked = await stockTheShop(shop);
    return { current: shop, ...stocked };
  }

  async function checkout(current: TestShop, variantId: string, rateId: string) {
    const { token } = await fillCart(current, variantId, rateId);
    const started = await current.storefront(
      "POST",
      `/delivery/shop/carts/${token}/checkout`,
      CHECKOUT_PAGES,
    );
    expect(started.statusCode).toBe(201);
    return started.json() as {
      checkoutId: string;
      url: string;
      total: { amount: number };
    };
  }

  function paidSession(id: string, checkoutId: string, amount: number) {
    return {
      id,
      payment_status: "paid",
      amount_total: amount,
      currency: "gbp",
      payment_intent: "pi_paid",
      client_reference_id: checkoutId,
      metadata: { lintel_checkout_id: checkoutId },
    };
  }

  const orderCount = async (current: TestShop) =>
    (await current.admin("GET", "/shop/orders")).json().total as number;

  async function status(current: TestShop, checkoutId: string) {
    return (await current.storefront("GET", `/delivery/shop/checkouts/${checkoutId}`)).json();
  }

  it(
    "places the order when the shopper comes back, and a later webhook does nothing extra",
    async () => {
      const { current, variantId, rateId, product } = await start();
      const { checkoutId, total } = await checkout(current, variantId, rateId);
      const sessionId = current.stripe.lastSessionId;
      expect((await status(current, checkoutId)).status).toBe("open");

      current.stripe.sessions.set(sessionId, paidSession(sessionId, checkoutId, total.amount));
      current.clock.advanceMinutes(1);
      const answer = await status(current, checkoutId);
      expect(answer).toMatchObject({ status: "completed", orderName: "#1001" });

      const webhook = await current.sendWebhook({
        id: "evt_after_return",
        type: "checkout.session.completed",
        data: { object: paidSession(sessionId, checkoutId, total.amount) },
      });
      expect(webhook.statusCode).toBe(200);
      expect(await orderCount(current)).toBe(1);
      const stock = await current.admin("GET", `/shop/products/${product.id}`);
      expect(stock.json().variants[0].stock[0].onHand).toBe(4);
    },
    SLOW_TEST,
  );

  it(
    "places one order when the return and the webhook race",
    async () => {
      const { current, variantId, rateId } = await start();
      const { checkoutId, total } = await checkout(current, variantId, rateId);
      const sessionId = current.stripe.lastSessionId;
      const paid = paidSession(sessionId, checkoutId, total.amount);
      current.stripe.sessions.set(sessionId, paid);

      const [returned, webhook] = await Promise.all([
        status(current, checkoutId),
        current.sendWebhook({
          id: "evt_race",
          type: "checkout.session.completed",
          data: { object: paid },
        }),
      ]);
      expect(webhook.statusCode).toBe(200);
      expect(returned.checkoutId).toBe(checkoutId);
      expect(await orderCount(current)).toBe(1);
      expect((await status(current, checkoutId)).status).toBe("completed");
    },
    SLOW_TEST,
  );

  it(
    "sends a payment that doesn't match the checkout to review, on the return too",
    async () => {
      const { current, variantId, rateId } = await start();
      const { checkoutId, total } = await checkout(current, variantId, rateId);
      const sessionId = current.stripe.lastSessionId;
      current.stripe.sessions.set(sessionId, paidSession(sessionId, checkoutId, total.amount - 1));

      expect((await status(current, checkoutId)).status).toBe("needs_review");
      expect(await orderCount(current)).toBe(0);
    },
    SLOW_TEST,
  );

  it(
    "believes nothing but Stripe: an unpaid session places no order",
    async () => {
      const { current, variantId, rateId } = await start();
      const { checkoutId } = await checkout(current, variantId, rateId);
      expect((await status(current, checkoutId)).status).toBe("open");
      expect(await orderCount(current)).toBe(0);
    },
    SLOW_TEST,
  );

  it(
    "doesn't ask Stripe on every poll",
    async () => {
      const { current, variantId, rateId } = await start();
      const { checkoutId } = await checkout(current, variantId, rateId);
      const asks = () =>
        current.stripe.requests.filter(
          (request) => request.method === "GET" && request.path.includes("/checkout/sessions/"),
        ).length;
      await status(current, checkoutId);
      await status(current, checkoutId);
      await status(current, checkoutId);
      expect(asks()).toBe(1);
      current.clock.advanceMinutes(1);
      await status(current, checkoutId);
      expect(asks()).toBe(2);
    },
    SLOW_TEST,
  );

  it(
    "sends shoppers back with the checkout's id in the address",
    async () => {
      const { current, variantId, rateId } = await start();
      const { checkoutId } = await checkout(current, variantId, rateId);
      const session = current.stripe.requestsTo("/v1/checkout/sessions").at(-1);
      expect(session?.form.get("success_url")).toContain(`checkout=${checkoutId}`);
    },
    SLOW_TEST,
  );

  it(
    "places an order from Stripe's events when the shopper never comes back, and only once",
    async () => {
      const { current, variantId, rateId } = await start(NO_WEBHOOK_SECRET);
      const { checkoutId, total } = await checkout(current, variantId, rateId);
      const event = {
        id: "evt_polled",
        type: "checkout.session.completed",
        created: Math.floor(current.clock.now.getTime() / 1000),
        data: { object: paidSession("cs_x", checkoutId, total.amount) },
      };
      current.stripe.events.push(event);

      const state = newPaymentCheckState();
      await expect(checkPayments(current.server.shop, state)).resolves.toBe(5000);
      expect(await orderCount(current)).toBe(1);
      const asked = current.stripe.requestsTo("/v1/events").at(-1);
      expect(asked?.query.get("types[0]")).toBe("checkout.session.completed");

      // The same event read again, as each read overlaps the last.
      await checkPayments(current.server.shop, state);
      expect(await orderCount(current)).toBe(1);
    },
    SLOW_TEST,
  );

  it(
    "places one order when a polled event and a webhook share an event id",
    async () => {
      const { current, variantId, rateId } = await start();
      const { checkoutId, total } = await checkout(current, variantId, rateId);
      const event = {
        id: "evt_both",
        type: "checkout.session.completed",
        created: Math.floor(current.clock.now.getTime() / 1000),
        data: { object: paidSession("cs_y", checkoutId, total.amount) },
      };
      current.stripe.events.push(event);

      const state = newPaymentCheckState();
      await checkPayments(current.server.shop, state);
      const webhook = await current.sendWebhook(event);
      expect(webhook.json()).toMatchObject({ received: true, duplicate: true });
      expect(await orderCount(current)).toBe(1);
    },
    SLOW_TEST,
  );

  it(
    "keeps the signature check on the webhook route",
    async () => {
      const { current } = await start();
      const forged = await current.server.inject({
        method: "POST",
        url: "/shop/stripe/webhook",
        payload: JSON.stringify({ id: "evt_forged", type: "x", data: { object: {} } }),
        headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=nope" },
      });
      expect(forged.statusCode).toBe(400);
    },
    SLOW_TEST,
  );

  it(
    "doesn't check with Stripe when a public shop has its webhook set up",
    async () => {
      const { current, variantId, rateId } = await start(
        FAKE_STRIPE_ENVIRONMENT,
        "https://shop.example.com",
      );
      await checkout(current, variantId, rateId);
      const wait = await checkPayments(current.server.shop, newPaymentCheckState());
      expect(wait).toBe(60_000);
      expect(current.stripe.requestsTo("/v1/events")).toHaveLength(0);
      const settings = await current.admin("GET", "/shop/settings/payments");
      expect(settings.json()).toMatchObject({ siteIsLocal: false, checksForPayments: false });
    },
    SLOW_TEST,
  );

  it(
    "checks a public shop that has no signing secret yet",
    async () => {
      const { current, variantId, rateId } = await start(
        NO_WEBHOOK_SECRET,
        "https://shop.example.com",
      );
      await checkout(current, variantId, rateId);
      await checkPayments(current.server.shop, newPaymentCheckState());
      expect(current.stripe.requestsTo("/v1/events")).toHaveLength(1);
      const settings = await current.admin("GET", "/shop/settings/payments");
      expect(settings.json()).toMatchObject({ connected: false, checksForPayments: true });
    },
    SLOW_TEST,
  );

  it(
    "goes quiet when nothing is happening, and picks up where it left off",
    async () => {
      const { current } = await start(NO_WEBHOOK_SECRET);
      const state = newPaymentCheckState();
      await checkPayments(current.server.shop, state);
      await checkPayments(current.server.shop, state);
      expect(current.stripe.requestsTo("/v1/events")).toHaveLength(1);

      current.clock.advanceMinutes(6);
      await checkPayments(current.server.shop, state);
      const asks = current.stripe.requestsTo("/v1/events");
      expect(asks).toHaveLength(2);
      const from = Number(asks[1]?.query.get("created[gte]"));
      expect(from).toBe(Math.floor(current.clock.now.getTime() / 1000) - 8 * 60);
    },
    SLOW_TEST,
  );

  it(
    "backs off when Stripe can't be reached",
    async () => {
      const { current, variantId, rateId } = await start(NO_WEBHOOK_SECRET);
      await checkout(current, variantId, rateId);
      current.stripe.failNext = { path: "/v1/events", status: 500, message: "Down" };
      const wait = await checkPayments(current.server.shop, newPaymentCheckState());
      expect(wait).toBe(10_000);
    },
    SLOW_TEST,
  );

  it(
    "releases the stock when a delayed payment fails, whichever way the news arrives",
    async () => {
      const { current, variantId, rateId, product } = await start(NO_WEBHOOK_SECRET);
      const { checkoutId } = await checkout(current, variantId, rateId);
      current.stripe.events.push({
        id: "evt_failed",
        type: "checkout.session.async_payment_failed",
        created: Math.floor(current.clock.now.getTime() / 1000),
        data: { object: { id: "cs_z", metadata: { lintel_checkout_id: checkoutId } } },
      });
      await checkPayments(current.server.shop, newPaymentCheckState());
      expect((await status(current, checkoutId)).status).toBe("expired");
      const types = current.stripe.requestsTo("/v1/events").at(-1)?.query;
      expect([...(types?.values() ?? [])]).toContain("checkout.session.async_payment_failed");
      const cart = await current.admin("GET", `/shop/products/${product.id}`);
      expect(cart.json().variants[0].available).toBe(5);
    },
    SLOW_TEST,
  );

  it(
    "takes the money and places the order for an approved PayPal payment",
    async () => {
      const { current, market, variantId, rateId } = await start({
        PAYPAL_CLIENT_ID: FAKE_PAYPAL.clientId,
        PAYPAL_CLIENT_SECRET: FAKE_PAYPAL.clientSecret,
      });
      await current.admin("PATCH", `/shop/markets/${market.id}`, { paymentProvider: "paypal" });
      const { checkoutId } = await checkout(current, variantId, rateId);
      const [order] = [...current.paypal.orders.values()];
      if (!order) throw new Error("The checkout should have made a PayPal order");

      await checkPayments(current.server.shop, newPaymentCheckState());
      expect(await orderCount(current)).toBe(0);

      order.status = "APPROVED";
      await checkPayments(current.server.shop, newPaymentCheckState());
      expect(await orderCount(current)).toBe(1);
      expect((await status(current, checkoutId)).status).toBe("completed");
      await checkPayments(current.server.shop, newPaymentCheckState());
      expect(await orderCount(current)).toBe(1);
    },
    SLOW_TEST,
  );

  it(
    "connects PayPal on someone's own computer without a webhook",
    async () => {
      const { current } = await start({
        PAYPAL_CLIENT_ID: FAKE_PAYPAL.clientId,
        PAYPAL_CLIENT_SECRET: FAKE_PAYPAL.clientSecret,
      });
      const providers = await current.admin("GET", "/shop/settings/payment-providers");
      expect(providers.json().paypal).toMatchObject({ connected: true, checksForPayments: true });
    },
    SLOW_TEST,
  );

  it(
    "finds a paid Mollie payment and settles its refund",
    async () => {
      const { current, market, variantId, rateId } = await start({
        MOLLIE_API_KEY: FAKE_MOLLIE_API_KEY,
      });
      await current.admin("PATCH", `/shop/markets/${market.id}`, { paymentProvider: "mollie" });
      await checkout(current, variantId, rateId);
      const [payment] = [...current.mollie.payments.values()];
      if (!payment) throw new Error("The checkout should have made a Mollie payment");

      payment.status = "paid";
      await checkPayments(current.server.shop, newPaymentCheckState());
      expect(await orderCount(current)).toBe(1);

      const orders = (await current.admin("GET", "/shop/orders")).json().items;
      await current.admin("POST", `/shop/orders/${orders[0].id}/refunds`, {
        amount: 100,
        reason: "Test",
      });
      const refund = payment.refunds[0];
      if (!refund) throw new Error("The refund should have reached Mollie");
      refund.status = "refunded";
      await checkPayments(current.server.shop, newPaymentCheckState());
      const order = await current.admin("GET", `/shop/orders/${orders[0].id}`);
      expect(order.json().refunds[0].status).toBe("succeeded");
    },
    SLOW_TEST,
  );

  const isTestOrder = async (current: TestShop) =>
    (await current.admin("GET", "/shop/orders")).json().items[0].isTest as boolean;
  const salesCount = async (current: TestShop) =>
    (await current.admin("GET", "/shop/sales/summary?days=30")).json().byCurrency.length as number;

  it(
    "marks a Stripe test-mode payment as a test, by webhook",
    async () => {
      const { current, variantId, rateId } = await start();
      const { checkoutId, total } = await checkout(current, variantId, rateId);
      await current.sendWebhook({
        id: "evt_test_mode",
        type: "checkout.session.completed",
        livemode: false,
        data: { object: paidSession("cs_t", checkoutId, total.amount) },
      });
      expect(await isTestOrder(current)).toBe(true);
      expect(await salesCount(current)).toBe(0);
      const customers = await current.admin("GET", "/shop/customers");
      expect(customers.json().items[0].orderCount).toBe(0);
      const sent = current.server.emailOutbox?.sent ?? [];
      expect(sent.at(-1)?.subject).toMatch(/^Test order: /);
      expect(sent.at(-1)?.to).toContain("ada@example.com");
    },
    SLOW_TEST,
  );

  it(
    "marks a Stripe test-mode payment as a test, on the return and from polled events",
    async () => {
      const { current, variantId, rateId } = await start(NO_WEBHOOK_SECRET);
      const first = await checkout(current, variantId, rateId);
      const sessionId = current.stripe.lastSessionId;
      current.stripe.sessions.set(sessionId, {
        ...paidSession(sessionId, first.checkoutId, first.total.amount),
        livemode: false,
      });
      await status(current, first.checkoutId);
      expect(await isTestOrder(current)).toBe(true);

      const second = await checkout(current, variantId, rateId);
      current.stripe.events.push({
        id: "evt_polled_test",
        type: "checkout.session.completed",
        created: Math.floor(current.clock.now.getTime() / 1000),
        livemode: false,
        data: { object: paidSession("cs_p", second.checkoutId, second.total.amount) },
      });
      await checkPayments(current.server.shop, newPaymentCheckState());
      const orders = (await current.admin("GET", "/shop/orders")).json();
      expect(orders.total).toBe(2);
      expect(orders.items.every((order: { isTest: boolean }) => order.isTest)).toBe(true);
    },
    SLOW_TEST,
  );

  it(
    "never hides a live Stripe payment, or one that doesn't say",
    async () => {
      const { current, variantId, rateId } = await start();
      const live = await checkout(current, variantId, rateId);
      await current.sendWebhook({
        id: "evt_live",
        type: "checkout.session.completed",
        livemode: true,
        data: { object: paidSession("cs_l", live.checkoutId, live.total.amount) },
      });
      expect(await isTestOrder(current)).toBe(false);

      const unsaid = await checkout(current, variantId, rateId);
      const sessionId = current.stripe.lastSessionId;
      current.stripe.sessions.set(
        sessionId,
        paidSession(sessionId, unsaid.checkoutId, unsaid.total.amount),
      );
      await status(current, unsaid.checkoutId);
      const orders = (await current.admin("GET", "/shop/orders")).json();
      expect(orders.total).toBe(2);
      expect(orders.items.some((order: { isTest: boolean }) => order.isTest)).toBe(false);
      expect(await salesCount(current)).toBe(1);
    },
    SLOW_TEST,
  );

  it(
    "refunds a test-mode order through Stripe, then deletes it for good",
    async () => {
      const { current, variantId, rateId, product } = await start();
      const { checkoutId, total } = await checkout(current, variantId, rateId);
      const paid = paidSession("cs_d", checkoutId, total.amount);
      await current.sendWebhook({
        id: "evt_delete_1",
        type: "checkout.session.completed",
        livemode: false,
        data: { object: paid },
      });
      const [order] = (await current.admin("GET", "/shop/orders")).json().items;
      const refund = await current.admin("POST", `/shop/orders/${order.id}/refunds`, {
        amount: 100,
      });
      expect(refund.statusCode).toBe(201);
      expect(current.stripe.requestsTo("/v1/refunds")).toHaveLength(1);

      const deleted = await current.admin("DELETE", "/shop/test-orders");
      expect(deleted.json()).toEqual({ deleted: 1 });
      const stock = await current.admin("GET", `/shop/products/${product.id}`);
      expect(stock.json().variants[0].stock[0].onHand).toBe(5);

      // Stripe's other message about the same payment must not bring the order back.
      const late = await current.sendWebhook({
        id: "evt_delete_2",
        type: "payment_intent.succeeded",
        livemode: false,
        data: {
          object: {
            id: "pi_paid",
            status: "succeeded",
            amount_received: total.amount,
            currency: "gbp",
            metadata: { lintel_checkout_id: checkoutId },
          },
        },
      });
      expect(late.statusCode).toBe(200);
      expect(await orderCount(current)).toBe(0);
    },
    SLOW_TEST,
  );

  it(
    "marks a Mollie test payment as a test, and a live one as a sale",
    async () => {
      const { current, market, variantId, rateId } = await start({
        MOLLIE_API_KEY: FAKE_MOLLIE_API_KEY,
      });
      await current.admin("PATCH", `/shop/markets/${market.id}`, { paymentProvider: "mollie" });
      current.mollie.paymentMode = "test";
      await checkout(current, variantId, rateId);
      const [testPayment] = [...current.mollie.payments.values()];
      if (!testPayment) throw new Error("The checkout should have made a Mollie payment");
      testPayment.status = "paid";
      await current.sendMollieWebhook(testPayment.id);
      expect(await isTestOrder(current)).toBe(true);
      expect(await salesCount(current)).toBe(0);

      current.mollie.paymentMode = "live";
      await checkout(current, variantId, rateId);
      const livePayment = [...current.mollie.payments.values()].at(-1);
      if (!livePayment) throw new Error("The checkout should have made a Mollie payment");
      livePayment.status = "paid";
      await current.sendMollieWebhook(livePayment.id);
      expect(await isTestOrder(current)).toBe(false);
      expect(await salesCount(current)).toBe(1);

      expect((await current.admin("DELETE", "/shop/test-orders")).json()).toEqual({ deleted: 1 });
      expect(await orderCount(current)).toBe(1);
    },
    SLOW_TEST,
  );

  it.each([
    ["sandbox", true],
    ["live", false],
  ] as const)(
    "reads a PayPal %s payment's test marking from the account",
    async (environment, isTest) => {
      const { current, market, variantId, rateId } = await start({
        PAYPAL_CLIENT_ID: FAKE_PAYPAL.clientId,
        PAYPAL_CLIENT_SECRET: FAKE_PAYPAL.clientSecret,
        PAYPAL_ENVIRONMENT: environment,
      });
      await current.admin("PATCH", `/shop/markets/${market.id}`, { paymentProvider: "paypal" });
      await checkout(current, variantId, rateId);
      const [order] = [...current.paypal.orders.values()];
      if (!order) throw new Error("The checkout should have made a PayPal order");
      order.status = "APPROVED";
      await checkPayments(current.server.shop, newPaymentCheckState());
      expect(await isTestOrder(current)).toBe(isTest);
      expect(await salesCount(current)).toBe(isTest ? 0 : 1);
    },
    SLOW_TEST,
  );

  it(
    "still places one shopper's order when asking about another's payment fails",
    async () => {
      const { current, variantId, rateId, market } = await start({
        ...FAKE_STRIPE_ENVIRONMENT,
        MOLLIE_API_KEY: FAKE_MOLLIE_API_KEY,
      });
      await current.admin("PATCH", `/shop/markets/${market.id}`, { paymentProvider: "mollie" });
      await checkout(current, variantId, rateId);
      const paying = await checkout(current, variantId, rateId);
      const [stuck, paid] = [...current.mollie.payments.values()];
      if (!stuck || !paid) throw new Error("Both checkouts should have made a payment");
      current.mollie.unavailablePayments.add(stuck.id);
      paid.status = "paid";

      await checkPayments(current.server.shop, newPaymentCheckState());

      const [row] = await testDatabase.database
        .select()
        .from(checkoutsTable)
        .where(eq(checkoutsTable.id, paying.checkoutId));
      expect(row?.status).toBe("completed");
    },
    SLOW_TEST,
  );

  it("knows which addresses a provider can't reach", () => {
    for (const address of [
      "http://localhost:4100",
      "http://127.0.0.1:4100",
      "http://192.168.1.20:4100",
      "http://10.0.0.5",
      "http://172.20.0.1",
      "http://[::1]:4100",
      "http://bakery.test",
      "http://mac.local",
    ]) {
      expect(isLocalAddress(address)).toBe(true);
    }
    for (const address of ["https://shop.example.com", "http://172.32.0.1", "https://8.8.8.8"]) {
      expect(isLocalAddress(address)).toBe(false);
    }
  });
});
