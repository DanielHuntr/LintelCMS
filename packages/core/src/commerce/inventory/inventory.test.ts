import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

describe("holding stock for checkouts", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop;
  let server: FastifyInstance;

  beforeEach(async () => {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase);
    server = shop.server;
  });
  afterEach(() => server.close());

  function checkout(token: string) {
    return shop.storefront("POST", `/delivery/shop/carts/${token}/checkout`, CHECKOUT_PAGES);
  }

  it(
    "never sells more than there is, however many shoppers check out at once",
    async () => {
      const { variantId, rateId, product } = await stockTheShop(shop, { stock: 2 });
      const carts = [];
      for (let shopper = 0; shopper < 6; shopper++) {
        carts.push(await fillCart(shop, variantId, rateId, 1));
      }

      const results = await Promise.all(carts.map(({ token }) => checkout(token)));

      const started = results.filter((result) => result.statusCode === 201);
      const refused = results.filter((result) => result.statusCode === 409);
      expect(started).toHaveLength(2);
      expect(refused).toHaveLength(4);
      for (const result of refused) {
        expect(result.json()).toMatchObject({ code: "OUT_OF_STOCK", variantId, available: 0 });
        expect(result.json().message).toBe("Linen shirt (M) is out of stock.");
      }
      const stock = await shop.admin("GET", `/shop/products/${product.id}`);
      expect(stock.json().variants[0]).toMatchObject({ available: 0, held: 2 });
    },
    SLOW_TEST,
  );

  it(
    "says how many are left when a shopper asks for more",
    async () => {
      const { variantId, rateId } = await stockTheShop(shop, { stock: 3 });
      const { token, cart } = await fillCart(shop, variantId, rateId, 5);
      expect(cart.lines[0]).toMatchObject({ problem: "not_enough_stock", quantityAvailable: 3 });
      expect(cart.readyForCheckout).toBe(false);

      const refused = await checkout(token);
      expect(refused.statusCode).toBe(409);
      expect(refused.json()).toMatchObject({ code: "OUT_OF_STOCK", available: 3 });
      expect(refused.json().message).toBe("Only 3 of Linen shirt (M) are left.");
    },
    SLOW_TEST,
  );

  it(
    "puts held stock back on sale when the checkout window closes",
    async () => {
      const { variantId, rateId, product } = await stockTheShop(shop, { stock: 1 });
      const first = await fillCart(shop, variantId, rateId, 1);
      const second = await fillCart(shop, variantId, rateId, 1);
      expect((await checkout(first.token)).statusCode).toBe(201);
      expect((await checkout(second.token)).statusCode).toBe(409);

      shop.clock.advanceMinutes(36);
      const context = createShopContext(server, {
        environment: FAKE_STRIPE_ENVIRONMENT,
        stripeFetch: shop.stripe.fetch,
        now: () => shop.clock.now,
      });
      expect(await expireAbandonedCheckouts(context)).toBe(1);

      const stock = await shop.admin("GET", `/shop/products/${product.id}`);
      expect(stock.json().variants[0]).toMatchObject({ available: 1, held: 0 });
      expect((await checkout(second.token)).statusCode).toBe(201);
    },
    SLOW_TEST,
  );

  it(
    "lets a shopper start checkout again without holding their stock twice",
    async () => {
      const { variantId, rateId, product } = await stockTheShop(shop, { stock: 1 });
      const { token } = await fillCart(shop, variantId, rateId, 1);
      expect((await checkout(token)).statusCode).toBe(201);
      expect((await checkout(token)).statusCode).toBe(201);

      const stock = await shop.admin("GET", `/shop/products/${product.id}`);
      expect(stock.json().variants[0]).toMatchObject({ available: 0, held: 1 });
      // The first payment page is closed, so it can't be paid as well.
      expect(shop.stripe.requests.some((request) => request.path.endsWith("/expire"))).toBe(true);
    },
    SLOW_TEST,
  );

  it(
    "sells untracked variants without counting them",
    async () => {
      const { variantId, rateId } = await stockTheShop(shop, { stock: 0, tracked: false });
      const { token, cart } = await fillCart(shop, variantId, rateId, 50);
      expect(cart.lines[0]).toMatchObject({ problem: null, quantityAvailable: null });
      expect((await checkout(token)).statusCode).toBe(201);
    },
    SLOW_TEST,
  );
});
