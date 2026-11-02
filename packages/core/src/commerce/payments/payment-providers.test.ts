import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../../testing/test-database.js";
import { FAKE_MOLLIE_API_KEY } from "../testing/fake-mollie.js";
import { FAKE_PAYPAL } from "../testing/fake-paypal.js";
import {
  CHECKOUT_PAGES,
  fillCart,
  startTestShop,
  stockTheShop,
  type TestShop,
} from "../testing/test-shop.js";
import { fromDecimalAmount, toDecimalAmount } from "./provider-amounts.js";

/**
 * PayPal and Mollie behind the PaymentProvider interface, with both faked (no network).
 * The test shop sells a £45 shirt with £4.95 delivery and 20% tax on top, so one shirt
 * comes to £59.94.
 */
const SLOW_TEST = 60_000;
const ONE_SHIRT_TOTAL = 5994;

describe("decimal amounts for PayPal and Mollie", () => {
  it("turns minor units into decimal strings and back without floating point", () => {
    expect(toDecimalAmount(5994, "GBP")).toBe("59.94");
    expect(toDecimalAmount(5, "EUR")).toBe("0.05");
    expect(toDecimalAmount(1999, "JPY")).toBe("1999");
    expect(toDecimalAmount(1234, "KWD")).toBe("1.234");
    expect(fromDecimalAmount("59.94", "GBP")).toBe(5994);
    expect(fromDecimalAmount("59.9", "GBP")).toBe(5990);
    expect(fromDecimalAmount("1999", "JPY")).toBe(1999);
    expect(fromDecimalAmount("59.945", "GBP")).toBeNull();
    expect(fromDecimalAmount("-1.00", "GBP")).toBeNull();
  });
});

describe("other payment providers", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop;
  beforeEach(async () => {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase);
  });
  afterEach(() => shop.server.close());

  async function chooseProvider(marketId: string, paymentProvider: string) {
    const changed = await shop.admin("PATCH", `/shop/markets/${marketId}`, { paymentProvider });
    expect(changed.json().paymentProvider).toBe(paymentProvider);
  }

  it(
    "connects PayPal, takes a payment on PayPal's page and refunds it",
    async () => {
      const { variantId, rateId, market } = await stockTheShop(shop);

      const wrong = await shop.admin("PUT", "/shop/settings/payment-providers/paypal", {
        ...FAKE_PAYPAL,
        clientSecret: "WrongWrongWrongWrongWrongWrong",
      });
      expect(wrong.statusCode).toBe(502);
      expect(wrong.json().message).toContain("didn't accept that Client ID and secret");
      const connected = await shop.admin("PUT", "/shop/settings/payment-providers/paypal", {
        ...FAKE_PAYPAL,
        environment: "sandbox",
      });
      expect(connected.statusCode).toBe(200);
      expect(connected.json().paypal).toMatchObject({
        connected: true,
        mode: "test",
        source: "admin",
        webhookIdSet: true,
        webhookUrl: "http://localhost:4000/shop/paypal/webhook",
      });
      expect(connected.body).not.toContain(FAKE_PAYPAL.clientSecret);
      await chooseProvider(market.id, "paypal");

      const { token } = await fillCart(shop, variantId, rateId, 1);
      const started = await shop.storefront(
        "POST",
        `/delivery/shop/carts/${token}/checkout`,
        CHECKOUT_PAGES,
      );
      expect(started.statusCode).toBe(201);
      const checkout = started.json();
      expect(checkout).toMatchObject({ provider: "paypal", mode: "hosted", clientSecret: null });
      expect(checkout.url).toMatch(/^https:\/\/www\.sandbox\.paypal\.com\/checkoutnow\?token=/);
      const [created] = shop.paypal.requestsTo("/v2/checkout/orders");
      expect(created?.headers.get("paypal-request-id")).toBe(
        `lintel-checkout-${checkout.checkoutId}`,
      );
      expect(created?.body).toMatchObject({
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: checkout.checkoutId,
            amount: {
              currency_code: "GBP",
              value: "59.94",
              breakdown: {
                item_total: { value: "45.00" },
                shipping: { value: "4.95" },
                tax_total: { value: "9.99" },
              },
            },
          },
        ],
      });
      const paypalOrderId = String(checkout.url).split("token=")[1];

      // A forged message is refused: PayPal doesn't confirm it.
      const forged = await shop.sendPayPalWebhook(
        {
          id: "WH-FORGED",
          event_type: "PAYMENT.CAPTURE.COMPLETED",
          resource: {
            id: "CAPTUREFORGED",
            custom_id: checkout.checkoutId,
            amount: { currency_code: "GBP", value: "59.94" },
          },
        },
        "made-up-signature",
      );
      expect(forged.statusCode).toBe(400);
      expect(forged.json().code).toBe("INVALID_SIGNATURE");

      // The shopper approves; the webhook takes the money.
      const approved = await shop.sendPayPalWebhook({
        id: "WH-APPROVED",
        event_type: "CHECKOUT.ORDER.APPROVED",
        resource: { id: paypalOrderId, purchase_units: [{ custom_id: checkout.checkoutId }] },
      });
      expect(approved.statusCode).toBe(200);
      expect(shop.paypal.requestsTo(`/v2/checkout/orders/${paypalOrderId}/capture`)).toHaveLength(
        1,
      );

      // The capture's webhook places the order, once.
      const captured = {
        id: "WH-CAPTURED",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          id: "CAPTURE123",
          status: "COMPLETED",
          custom_id: checkout.checkoutId,
          amount: { currency_code: "GBP", value: "59.94" },
        },
      };
      expect((await shop.sendPayPalWebhook(captured)).json()).toEqual({
        received: true,
        duplicate: false,
      });
      expect((await shop.sendPayPalWebhook(captured)).json().duplicate).toBe(true);
      const orders = await shop.admin("GET", "/shop/orders");
      expect(orders.json().total).toBe(1);
      const orderId: string = orders.json().items[0].id;
      const order = (await shop.admin("GET", `/shop/orders/${orderId}`)).json();
      expect(order).toMatchObject({
        paymentProvider: "paypal",
        total: { amount: ONE_SHIRT_TOTAL },
      });
      expect(order.timeline.map((event: { message: string }) => event.message)).toContain(
        "Payment of £59.94 received through PayPal",
      );

      const refunded = await shop.admin("POST", `/shop/orders/${orderId}/refunds`, {
        amount: 1000,
        reason: "Late delivery",
      });
      expect(refunded.json()).toMatchObject({ refunded: { amount: 1000 } });
      const [refund] = shop.paypal.requestsTo("/v2/payments/captures/CAPTURE123/refund");
      expect(refund?.body).toMatchObject({ amount: { currency_code: "GBP", value: "10.00" } });
      expect(shop.stripe.requestsTo("/v1/refunds")).toHaveLength(0);
    },
    SLOW_TEST,
  );

  it(
    "never captures a PayPal approval that arrives after the checkout closed",
    async () => {
      const { variantId, rateId, market } = await stockTheShop(shop);
      await shop.admin("PUT", "/shop/settings/payment-providers/paypal", FAKE_PAYPAL);
      await chooseProvider(market.id, "paypal");
      const { token } = await fillCart(shop, variantId, rateId, 1);
      const checkout = (
        await shop.storefront("POST", `/delivery/shop/carts/${token}/checkout`, CHECKOUT_PAGES)
      ).json();
      const paypalOrderId = String(checkout.url).split("token=")[1];

      shop.clock.advanceMinutes(40);
      await shop.storefront("POST", `/delivery/shop/carts/${token}/checkout`, CHECKOUT_PAGES);
      await shop.sendPayPalWebhook({
        id: "WH-LATE",
        event_type: "CHECKOUT.ORDER.APPROVED",
        resource: { id: paypalOrderId, purchase_units: [{ custom_id: checkout.checkoutId }] },
      });
      expect(shop.paypal.requestsTo(`/v2/checkout/orders/${paypalOrderId}/capture`)).toHaveLength(
        0,
      );
    },
    SLOW_TEST,
  );

  it(
    "connects Mollie, believes only what Mollie says when fetched back, and refunds",
    async () => {
      const { variantId, rateId, market } = await stockTheShop(shop);
      const notAKey = await shop.admin("PUT", "/shop/settings/payment-providers/mollie", {
        apiKey: "sk_test_123",
      });
      expect(notAKey.statusCode).toBe(400);
      const connected = await shop.admin("PUT", "/shop/settings/payment-providers/mollie", {
        apiKey: FAKE_MOLLIE_API_KEY,
      });
      expect(connected.json().mollie).toMatchObject({ connected: true, mode: "test" });
      expect(connected.body).not.toContain(FAKE_MOLLIE_API_KEY);
      await chooseProvider(market.id, "mollie");

      const { token } = await fillCart(shop, variantId, rateId, 1);
      const checkout = (
        await shop.storefront("POST", `/delivery/shop/carts/${token}/checkout`, CHECKOUT_PAGES)
      ).json();
      expect(checkout).toMatchObject({ provider: "mollie", mode: "hosted" });
      expect(checkout.url).toMatch(/^https:\/\/www\.mollie\.com\/checkout\//);
      const [payment] = [...shop.mollie.payments.values()];
      expect(payment?.amount).toEqual({ currency: "GBP", value: "59.94" });

      // Mollie calls the webhook while the payment is still open: nothing happens.
      expect((await shop.sendMollieWebhook(payment?.id ?? "")).statusCode).toBe(200);
      expect((await shop.admin("GET", "/shop/orders")).json().total).toBe(0);
      // An id Mollie doesn't know is acknowledged and ignored.
      expect((await shop.sendMollieWebhook("tr_DoesNotExist")).statusCode).toBe(200);

      if (payment) payment.status = "paid";
      await shop.sendMollieWebhook(payment?.id ?? "");
      await shop.sendMollieWebhook(payment?.id ?? "");
      const orders = await shop.admin("GET", "/shop/orders");
      expect(orders.json().total).toBe(1);
      const orderId: string = orders.json().items[0].id;
      const order = (await shop.admin("GET", `/shop/orders/${orderId}`)).json();
      expect(order.paymentProvider).toBe("mollie");

      // Mollie refunds start pending, and settle when Mollie next calls the webhook.
      const refunded = await shop.admin("POST", `/shop/orders/${orderId}/refunds`, {
        lines: [{ orderLineId: order.lines[0].id, quantity: 1 }],
      });
      expect(refunded.json()).toMatchObject({
        refunded: { amount: 0 },
        refunds: [{ amount: { amount: 5400 }, status: "pending" }],
      });
      const refund = payment?.refunds[0];
      if (refund) refund.status = "refunded";
      await shop.sendMollieWebhook(payment?.id ?? "");
      const settled = (await shop.admin("GET", `/shop/orders/${orderId}`)).json();
      expect(settled).toMatchObject({
        refunded: { amount: 5400 },
        refunds: [{ status: "succeeded" }],
      });
    },
    SLOW_TEST,
  );

  it(
    "says plainly when a market's provider isn't connected",
    async () => {
      const { variantId, rateId, market } = await stockTheShop(shop);
      await chooseProvider(market.id, "mollie");
      const { token } = await fillCart(shop, variantId, rateId, 1);
      const refused = await shop.storefront(
        "POST",
        `/delivery/shop/carts/${token}/checkout`,
        CHECKOUT_PAGES,
      );
      expect(refused.statusCode).toBe(409);
      // Shoppers get plain words; the owner's set-up step is logged and shown on the Shop home.
      expect(refused.json()).toMatchObject({
        code: "SHOP_NOT_READY",
        message: "This shop isn't taking orders yet.",
      });
      const listed = await shop.admin("GET", "/shop/settings/payment-providers");
      expect(listed.json().markets).toEqual([
        expect.objectContaining({ name: "United Kingdom", paymentProvider: "mollie" }),
      ]);
    },
    SLOW_TEST,
  );
});
