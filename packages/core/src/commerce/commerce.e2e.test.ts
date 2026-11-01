import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import {
  CHECKOUT_PAGES,
  fillCart,
  startTestShop,
  stockTheShop,
  type TestShop,
} from "./testing/test-shop.js";

/**
 * The whole journey, as a shop owner and a shopper would take it: make a product, put it in
 * a cart, pay through Stripe (faked, no network), have the signed webhook turn the checkout
 * into an order, then refund part of it and send the rest.
 */
// The journey makes about forty requests against a real database, so it gets longer than
// the usual five seconds.
const JOURNEY_TIMEOUT = 60_000;

describe("selling a product from start to finish", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop;
  let server: FastifyInstance;

  beforeEach(async () => {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase);
    server = shop.server;
  });
  afterEach(() => server.close());

  it(
    "takes an order, refunds part of it and sends the rest",
    async () => {
      const { variantId, rateId, product } = await stockTheShop(shop);

      // The storefront sees the product, priced, without its stock count.
      const listed = await shop.storefront("GET", "/delivery/shop/products?country=GB");
      expect(listed.statusCode).toBe(200);
      expect(listed.json().items[0]).toMatchObject({
        handle: "linen-shirt",
        priceRange: { min: { amount: 4500, currency: "GBP" } },
        availableForSale: true,
      });
      expect(listed.json().items[0].variants[1].availableForSale).toBe(false);

      const { token, cart } = await fillCart(shop, variantId, rateId, 2);
      expect(cart).toMatchObject({
        email: "ada@example.com",
        subtotal: { amount: 9000, currency: "GBP" },
        shipping: { amount: 495, currency: "GBP" },
        total: { amount: 9495, currency: "GBP" },
        readyForCheckout: true,
      });

      // Checkout: Stripe Tax adds 20% on top, then a hosted payment page is made.
      const started = await shop.storefront(
        "POST",
        `/delivery/shop/carts/${token}/checkout`,
        CHECKOUT_PAGES,
      );
      expect(started.statusCode).toBe(201);
      const checkout = started.json();
      expect(checkout).toMatchObject({
        mode: "hosted",
        tax: { amount: 1899 },
        total: { amount: 11394, currency: "GBP" },
        publishableKey: "pk_test_fakekey4242",
      });
      expect(checkout.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
      const [session] = shop.stripe.requestsTo("/v1/checkout/sessions");
      expect(session?.form.get("line_items[0][price_data][unit_amount]")).toBe("4500");
      expect(session?.form.get("line_items[0][quantity]")).toBe("2");
      expect(session?.form.get("line_items[1][price_data][product_data][name]")).toBe("Tax");
      expect(session?.form.get("line_items[1][price_data][unit_amount]")).toBe("1899");
      expect(
        session?.form.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"),
      ).toBe("495");
      expect(session?.form.get("metadata[lintel_checkout_id]")).toBe(checkout.checkoutId);
      expect(session?.idempotencyKey).toBe(`lintel-checkout-${checkout.checkoutId}`);

      // Stock is held while the shopper pays, but nothing is an order yet.
      const held = await shop.admin("GET", `/shop/products/${product.id}`);
      expect(held.json().variants[0]).toMatchObject({ available: 3, held: 2 });
      const waiting = await shop.storefront(
        "GET",
        `/delivery/shop/checkouts/${checkout.checkoutId}`,
      );
      expect(waiting.json()).toMatchObject({ status: "open", orderName: null });
      expect((await shop.admin("GET", "/shop/orders")).json().total).toBe(0);

      // A forged "paid" message is refused.
      const forged = await server.inject({
        method: "POST",
        url: "/shop/stripe/webhook",
        headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=00" },
        payload: JSON.stringify({
          id: "evt_forged",
          type: "checkout.session.completed",
          data: { object: {} },
        }),
      });
      expect(forged.statusCode).toBe(400);
      expect(forged.json().code).toBe("INVALID_SIGNATURE");

      // Stripe's signed webhook makes the order, once, however often it is sent.
      const paidEvent = {
        id: "evt_paid_1",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_paid",
            payment_status: "paid",
            amount_total: 11394,
            currency: "gbp",
            payment_intent: "pi_test_paid",
            client_reference_id: checkout.checkoutId,
            metadata: { lintel_checkout_id: checkout.checkoutId },
          },
        },
      };
      const first = await shop.sendWebhook(paidEvent);
      const again = await shop.sendWebhook(paidEvent);
      expect(first.json()).toEqual({ received: true, duplicate: false });
      expect(again.json()).toEqual({ received: true, duplicate: true });

      const orders = await shop.admin("GET", "/shop/orders");
      expect(orders.json().total).toBe(1);
      const orderId: string = orders.json().items[0].id;
      let order = (await shop.admin("GET", `/shop/orders/${orderId}`)).json();
      expect(order).toMatchObject({
        name: "#1001",
        email: "ada@example.com",
        status: "paid",
        total: { amount: 11394, currency: "GBP" },
        tax: { amount: 1899 },
        refundable: { amount: 11394 },
      });
      const paidCheckout = await shop.storefront(
        "GET",
        `/delivery/shop/checkouts/${checkout.checkoutId}`,
      );
      expect(paidCheckout.json()).toMatchObject({ status: "completed", orderName: "#1001" });
      const afterSale = await shop.admin("GET", `/shop/products/${product.id}`);
      expect(afterSale.json().variants[0]).toMatchObject({ available: 3, held: 0 });
      expect(shop.stripe.requestsTo("/v1/tax/transactions/create_from_calculation")).toHaveLength(
        1,
      );

      // Refund one of the two shirts, through Stripe, and put it back in stock.
      const lineId: string = order.lines[0].id;
      const refunded = await shop.admin("POST", `/shop/orders/${orderId}/refunds`, {
        lines: [{ orderLineId: lineId, quantity: 1 }],
        reason: "Too small",
        restock: true,
      });
      expect(refunded.statusCode).toBe(201);
      order = refunded.json();
      expect(order).toMatchObject({
        status: "partially_refunded",
        refunded: { amount: 5400 },
        refundable: { amount: 5994 },
      });
      const [stripeRefund] = shop.stripe.requestsTo("/v1/refunds");
      expect(stripeRefund?.form.get("amount")).toBe("5400");
      expect(stripeRefund?.form.get("payment_intent")).toBe("pi_test_paid");
      const restocked = await shop.admin("GET", `/shop/products/${product.id}`);
      expect(restocked.json().variants[0].available).toBe(4);

      // Stripe confirming the same refund later changes nothing.
      await shop.sendWebhook({
        id: "evt_refund_1",
        type: "refund.updated",
        data: {
          object: {
            id: "re_test_000004",
            amount: 5400,
            currency: "gbp",
            status: "succeeded",
            payment_intent: "pi_test_paid",
            metadata: { lintel_refund_id: order.refunds[0].id },
          },
        },
      });
      order = (await shop.admin("GET", `/shop/orders/${orderId}`)).json();
      expect(order.refunded.amount).toBe(5400);
      expect(order.refunds).toHaveLength(1);

      // Send what's left, with a tracking number.
      const fulfilled = await shop.admin("POST", `/shop/orders/${orderId}/fulfilments`, {
        trackingCompany: "Royal Mail",
        trackingNumber: "RM123456789GB",
        trackingUrl: "https://www.royalmail.com/track-your-item#/tracking-results/RM123456789GB",
      });
      expect(fulfilled.statusCode).toBe(201);
      order = fulfilled.json();
      expect(order).toMatchObject({
        fulfilmentStatus: "fulfilled",
        paymentStatus: "partially_refunded",
      });
      expect(order.lines[0]).toMatchObject({
        fulfilledQuantity: 1,
        refundedQuantity: 1,
        unfulfilledQuantity: 0,
      });
      expect(order.timeline.map((event: { kind: string }) => event.kind)).toEqual(
        expect.arrayContaining(["placed", "paid", "refunded", "fulfilled", "email_sent"]),
      );

      // The three emails are waiting in the outbox.
      const emails = await shop.admin("GET", "/shop/emails");
      expect(emails.json().provider).toEqual({ name: "Outbox", deliversEmail: false });
      expect(
        emails
          .json()
          .items.map((email: { subject: string }) => email.subject)
          .sort(),
      ).toEqual(["Order #1001 confirmed", "Order #1001 is on its way", "Refund for order #1001"]);
      const shipped = emails
        .json()
        .items.find((email: { kind: string }) => email.kind === "order_shipped");
      const shippedEmail = await shop.admin("GET", `/shop/emails/${shipped.id}`);
      expect(shippedEmail.json().text).toContain("RM123456789GB");

      // A refund made in Stripe's own dashboard is recorded too.
      await shop.sendWebhook({
        id: "evt_refund_dashboard",
        type: "refund.created",
        data: {
          object: {
            id: "re_dashboard",
            amount: 1000,
            currency: "gbp",
            status: "succeeded",
            payment_intent: "pi_test_paid",
          },
        },
      });
      order = (await shop.admin("GET", `/shop/orders/${orderId}`)).json();
      expect(order.refunded.amount).toBe(6400);

      // The customer and the dashboard's numbers follow.
      const customers = await shop.admin("GET", "/shop/customers");
      expect(customers.json().items[0]).toMatchObject({
        email: "ada@example.com",
        name: "Ada Lovelace",
        orderCount: 1,
        totalSpent: [{ currency: "GBP", amount: 4994 }],
      });
      const sales = await shop.admin("GET", "/shop/sales/summary?days=7");
      expect(sales.json()).toMatchObject({
        primaryCurrency: "GBP",
        byCurrency: [{ currency: "GBP", sales: { amount: 4994 }, orderCount: 1 }],
        ordersToFulfil: 0,
      });
    },
    JOURNEY_TIMEOUT,
  );
});
