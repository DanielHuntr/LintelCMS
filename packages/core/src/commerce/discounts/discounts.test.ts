import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../../testing/test-database.js";
import {
  CHECKOUT_PAGES,
  DELIVERY_ADDRESS,
  fillCart,
  startTestShop,
  stockTheShop,
  type TestShop,
} from "../testing/test-shop.js";

/**
 * Discounts from the shop owner's screen to the shopper's cart, the order and its refunds.
 * Stripe is faked; the test shop sells a £45 linen shirt to the UK, with £4.95 delivery and
 * 20% tax added on top.
 */
const SLOW_TEST = 60_000;

describe("discounts", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop;
  beforeEach(async () => {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase);
  });
  afterEach(() => shop.server.close());

  const percentCode = (changes: Record<string, unknown> = {}) => ({
    title: "Summer sale",
    method: "code",
    code: "summer20",
    kind: "percentage",
    percentOff: 20,
    ...changes,
  });

  async function useCode(token: string, code: string) {
    return shop.storefront("PATCH", `/delivery/shop/carts/${token}`, { discountCodes: [code] });
  }

  it(
    "is made in the admin and explains in the cart why a code doesn't apply",
    async () => {
      const { variantId, rateId } = await stockTheShop(shop);
      const created = await shop.admin(
        "POST",
        "/shop/discounts",
        percentCode({ minimumSpend: { GBP: 5000 }, endsAt: "2026-12-31T23:59:00Z" }),
      );
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ code: "SUMMER20", status: "active", usageCount: 0 });

      const taken = await shop.admin("POST", "/shop/discounts", percentCode({ title: "Copy" }));
      expect(taken.statusCode).toBe(409);
      expect(taken.json().code).toBe("DISCOUNT_CODE_TAKEN");

      const missing = await shop.admin("POST", "/shop/discounts", {
        title: "No amount",
        method: "code",
        code: "NOAMOUNT",
        kind: "fixed_amount",
      });
      expect(missing.statusCode).toBe(400);
      expect(missing.json().message).toContain("at least one currency");

      await shop.admin(
        "POST",
        "/shop/discounts",
        percentCode({
          code: "SPRING",
          endsAt: "2026-05-31T23:59:00Z",
          startsAt: "2026-03-01T00:00:00Z",
        }),
      );
      const listed = await shop.admin("GET", "/shop/discounts");
      expect(listed.json().discounts.map((item: { status: string }) => item.status)).toEqual([
        "expired",
        "active",
      ]);

      const { token } = await fillCart(shop, variantId, rateId, 1);
      const expired = await useCode(token, "spring");
      expect(expired.statusCode).toBe(400);
      expect(expired.json()).toMatchObject({
        code: "DISCOUNT_CODE_INVALID",
        message: "This code has expired.",
      });
      const unknown = await useCode(token, "HELLO");
      expect(unknown.json().message).toBe("This code isn't valid. Check it's typed correctly.");
      const cart = await shop.storefront("GET", `/delivery/shop/carts/${token}`);
      expect(cart.json().discountCodes).toEqual([]);

      // A code that needs a bigger order stays in the cart, with what to do.
      const tooSmall = await useCode(token, "summer20");
      expect(tooSmall.statusCode).toBe(200);
      expect(tooSmall.json()).toMatchObject({
        discountCodes: ["SUMMER20"],
        discounts: [],
        discountProblems: [{ code: "SUMMER20", message: "Spend £50.00 or more to use this code." }],
        total: { amount: 4995 },
      });
      const lineId: string = tooSmall.json().lines[0].id;
      const enough = await shop.storefront(
        "PATCH",
        `/delivery/shop/carts/${token}/lines/${lineId}`,
        {
          quantity: 2,
        },
      );
      expect(enough.json()).toMatchObject({
        subtotal: { amount: 9000 },
        discounts: [
          { code: "SUMMER20", title: "Summer sale", amount: { amount: 1800 }, freeShipping: false },
        ],
        discountProblems: [],
        shipping: { amount: 495 },
        total: { amount: 9000 - 1800 + 495 },
      });
    },
    SLOW_TEST,
  );

  it(
    "carries discounts into the order, and refunds a line at its discounted price",
    async () => {
      const { variantId, rateId, product } = await stockTheShop(shop);
      await shop.admin("POST", "/shop/discounts", {
        title: "10% off shirts",
        method: "automatic",
        kind: "percentage",
        percentOff: 10,
        scope: "products",
        productIds: [product.id],
      });
      await shop.admin("POST", "/shop/discounts", {
        title: "Free delivery",
        method: "code",
        code: "FREESHIP",
        kind: "free_shipping",
      });

      const { token } = await fillCart(shop, variantId, rateId, 2);
      const cart = await useCode(token, "freeship");
      expect(cart.json()).toMatchObject({
        discounts: [
          { code: "FREESHIP", amount: { amount: 495 }, freeShipping: true },
          { code: "", title: "10% off shirts", amount: { amount: 900 }, freeShipping: false },
        ],
        shipping: { amount: 0 },
        total: { amount: 8100 },
      });

      const started = await shop.storefront(
        "POST",
        `/delivery/shop/carts/${token}/checkout`,
        CHECKOUT_PAGES,
      );
      expect(started.statusCode).toBe(201);
      const checkout = started.json();
      // Tax is on what's really paid: 20% of £81.00, and nothing on free delivery.
      expect(checkout).toMatchObject({
        provider: "stripe",
        discount: { amount: 900 },
        shipping: { amount: 0 },
        tax: { amount: 1620 },
        total: { amount: 9720 },
      });
      const [coupon] = shop.stripe.requestsTo("/v1/coupons");
      expect(coupon?.form.get("amount_off")).toBe("900");

      await shop.sendWebhook({
        id: "evt_paid_discounted",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_discounted",
            payment_status: "paid",
            amount_total: 9720,
            currency: "gbp",
            payment_intent: "pi_test_discounted",
            metadata: { lintel_checkout_id: checkout.checkoutId },
          },
        },
      });
      const orders = await shop.admin("GET", "/shop/orders");
      const orderId: string = orders.json().items[0].id;
      const order = (await shop.admin("GET", `/shop/orders/${orderId}`)).json();
      expect(order).toMatchObject({
        discount: { amount: 900 },
        discounts: [
          { code: "FREESHIP", title: "Free delivery", amount: { amount: 495 }, freeShipping: true },
          { code: "", title: "10% off shirts", amount: { amount: 900 } },
        ],
        lines: [{ quantity: 2, subtotal: { amount: 9000 }, discount: { amount: 900 } }],
        total: { amount: 9720 },
      });
      expect(order.timeline.map((event: { message: string }) => event.message)).toContain(
        "Code FREESHIP made delivery free (saving £4.95)",
      );

      // One shirt back: what was paid for it, £40.50 plus its £8.10 tax.
      const refunded = await shop.admin("POST", `/shop/orders/${orderId}/refunds`, {
        lines: [{ orderLineId: order.lines[0].id, quantity: 1 }],
      });
      expect(refunded.json().refunded.amount).toBe(4860);

      const listed = await shop.admin("GET", "/shop/discounts");
      expect(
        listed
          .json()
          .discounts.map((item: { title: string; usageCount: number }) => [
            item.title,
            item.usageCount,
          ]),
      ).toEqual([
        ["Free delivery", 1],
        ["10% off shirts", 1],
      ]);
    },
    SLOW_TEST,
  );

  it(
    "never lets two shoppers take the last use of a code at the same moment",
    async () => {
      const { variantId, rateId } = await stockTheShop(shop);
      await shop.admin("POST", "/shop/discounts", percentCode({ usageLimit: 1 }));
      const first = await fillCart(shop, variantId, rateId, 1);
      const second = await fillCart(shop, variantId, rateId, 1);
      expect((await useCode(first.token, "SUMMER20")).statusCode).toBe(200);
      expect((await useCode(second.token, "SUMMER20")).statusCode).toBe(200);

      const both = await Promise.all(
        [first.token, second.token].map((token) =>
          shop.storefront("POST", `/delivery/shop/carts/${token}/checkout`, CHECKOUT_PAGES),
        ),
      );
      expect(both.map((response) => response.statusCode).sort()).toEqual([201, 409]);
      const refused = both.find((response) => response.statusCode === 409);
      expect(refused?.json()).toMatchObject({
        code: "DISCOUNT_CODE_INVALID",
        message: "This code has reached its usage limit.",
      });
      // Only one checkout holds stock and a use; the refused one left nothing behind.
      expect(shop.stripe.requestsTo("/v1/checkout/sessions")).toHaveLength(1);

      // The winner walks away: once their checkout runs out, the use is free again.
      shop.clock.advanceMinutes(40);
      const refusedToken = both[0]?.statusCode === 409 ? first.token : second.token;
      const later = await shop.storefront(
        "POST",
        `/delivery/shop/carts/${refusedToken}/checkout`,
        CHECKOUT_PAGES,
      );
      expect(later.statusCode).toBe(201);
      expect(later.json().discount.amount).toBe(900);
    },
    SLOW_TEST,
  );

  it(
    "limits uses per customer by email",
    async () => {
      const { variantId, rateId } = await stockTheShop(shop);
      await shop.admin("POST", "/shop/discounts", percentCode({ perCustomerLimit: 1 }));
      const { token } = await fillCart(shop, variantId, rateId, 1);
      await useCode(token, "SUMMER20");
      const started = await shop.storefront(
        "POST",
        `/delivery/shop/carts/${token}/checkout`,
        CHECKOUT_PAGES,
      );
      await shop.sendWebhook({
        id: "evt_paid_once",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_once",
            payment_status: "paid",
            amount_total: started.json().total.amount,
            currency: "gbp",
            payment_intent: "pi_test_once",
            metadata: { lintel_checkout_id: started.json().checkoutId },
          },
        },
      });

      const again = await fillCart(shop, variantId, rateId, 1);
      const refused = await useCode(again.token, "summer20");
      expect(refused.statusCode).toBe(400);
      expect(refused.json().message).toBe("You've already used this code.");

      // Someone else can still use it.
      const other = await shop.storefront("POST", "/delivery/shop/carts", { country: "GB" });
      const otherToken: string = other.json().token;
      await shop.storefront("POST", `/delivery/shop/carts/${otherToken}/lines`, { variantId });
      await shop.storefront("PATCH", `/delivery/shop/carts/${otherToken}`, {
        email: "grace@example.com",
        shippingAddress: DELIVERY_ADDRESS,
        shippingRateId: rateId,
      });
      expect((await useCode(otherToken, "SUMMER20")).json().discounts[0].amount.amount).toBe(900);
    },
    SLOW_TEST,
  );
});
