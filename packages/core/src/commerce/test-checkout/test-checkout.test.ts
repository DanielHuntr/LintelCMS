import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../../testing/test-database.js";
import { buildSiteServer, type SiteServer } from "../../website/site-server.js";
import { customersTable } from "../customers/customers.table.js";
import { ordersTable } from "../orders/orders.table.js";
import {
  DELIVERY_ADDRESS,
  startTestShop,
  stockTheShop,
  type TestShop,
} from "../testing/test-shop.js";
import { checkTestToken, signTestToken, TEST_SESSION_COOKIE } from "./test-session-tokens.js";
import { insertReturning } from "../../database/dialect/writes.js";

const SLOW_TEST = 60_000;
const USER_ID = "00000000-0000-4000-8000-000000000001";
const NO_PAYMENT_ACCOUNT = {};

/**
 * The test checkout end to end, through the website as a browser reaches it, with no payment
 * account connected unless a test says otherwise.
 */
describe("the test checkout", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop | undefined;
  let website: SiteServer | undefined;

  afterEach(async () => {
    await website?.close();
    await shop?.server.close();
  });

  async function start(environment: Record<string, string> = NO_PAYMENT_ACCOUNT) {
    shop = await startTestShop(
      testDatabase.database,
      testDatabase.activeDatabase,
      { environment },
      { website: { builtInSiteUrl: "http://localhost:3000" } },
    );
    website = buildSiteServer({ api: shop.server });
    await website.ready();
    const stocked = await stockTheShop(shop);
    return { current: shop, site: website, ...stocked };
  }

  /** What the admin's button and the browser's first visit do: the cookie's token. */
  async function openSession(current: TestShop, site: SiteServer) {
    const link = await current.admin("POST", "/shop/test-session");
    expect(link.statusCode).toBe(201);
    const { pathname, search } = new URL(link.json().url);
    const opened = await site.inject({ method: "GET", url: `${pathname}${search}` });
    expect(opened.statusCode).toBe(303);
    const setCookie = String(opened.headers["set-cookie"]);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    return /lintel_shop_test=([^;]+)/.exec(setCookie)?.[1] ?? "";
  }

  async function fillBasket(site: SiteServer, variantId: string, rateId: string, cookie?: string) {
    const cookies = cookie ? { [TEST_SESSION_COOKIE]: cookie } : undefined;
    const send = (method: "POST" | "PATCH", url: string, payload: object) =>
      site.inject({ method, url: `/_lintel/api/shop${url}`, payload, ...(cookies && { cookies }) });
    const created = await send("POST", "/carts", { country: "GB" });
    const token: string = created.json().token;
    await send("POST", `/carts/${token}/lines`, { variantId, quantity: 2 });
    await send("PATCH", `/carts/${token}`, {
      email: "tester@example.com",
      shippingAddress: DELIVERY_ADDRESS,
    });
    await send("PATCH", `/carts/${token}`, { shippingRateId: rateId });
    return send("POST", `/carts/${token}/checkout`, {
      successUrl: "http://localhost:3000/order-confirmation",
      cancelUrl: "http://localhost:3000/cart",
    });
  }

  function pay(site: SiteServer, checkoutId: string, cookie: string | undefined, outcome = "paid") {
    return site.inject({
      method: "POST",
      url: "/_lintel/shop-test/pay",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `checkout=${checkoutId}&outcome=${outcome}`,
      ...(cookie ? { cookies: { [TEST_SESSION_COOKIE]: cookie } } : {}),
    });
  }

  async function placeTestOrder(
    site: SiteServer,
    variantId: string,
    rateId: string,
    cookie: string,
  ) {
    const checkout = await fillBasket(site, variantId, rateId, cookie);
    expect(checkout.statusCode).toBe(201);
    const paid = await pay(site, checkout.json().checkoutId, cookie);
    expect(paid.statusCode).toBe(303);
    return checkout.json().checkoutId as string;
  }

  async function stockOf(current: TestShop, productId: string) {
    const product = await current.admin("GET", `/shop/products/${productId}`);
    return product.json().variants[0].stock[0].onHand as number;
  }

  it(
    "places a real order with no payment account, marked as test and left out of sales",
    async () => {
      const { current, site, variantId, rateId, product } = await start();
      const cookie = await openSession(current, site);

      const shopPage = await site.inject({
        method: "GET",
        url: "/shop",
        cookies: { [TEST_SESSION_COOKIE]: cookie },
      });
      expect(shopPage.body).toContain("Test order: no money is taken");
      expect(shopPage.body).not.toContain("Coming soon");
      expect(shopPage.headers["cache-control"]).toContain("no-store");
      expect(shopPage.headers.etag).toBeUndefined();

      const checkout = await fillBasket(site, variantId, rateId, cookie);
      expect(checkout.statusCode).toBe(201);
      expect(checkout.json()).toMatchObject({ provider: "test", mode: "hosted" });
      expect(checkout.json().url).toContain("/_lintel/shop-test/pay?checkout=");
      const checkoutId: string = checkout.json().checkoutId;

      const payPage = await site.inject({
        method: "GET",
        url: `/_lintel/shop-test/pay?checkout=${checkoutId}`,
        cookies: { [TEST_SESSION_COOKIE]: cookie },
      });
      expect(payPage.statusCode).toBe(200);
      expect(payPage.body).toContain("No money is taken");

      const paid = await pay(site, checkoutId, cookie);
      expect(paid.headers.location).toBe(`/order-confirmation?checkout=${checkoutId}`);
      // Pressing again changes nothing.
      expect((await pay(site, checkoutId, cookie)).statusCode).toBe(303);

      const orders = await current.admin("GET", "/shop/orders");
      expect(orders.json().total).toBe(1);
      const order = orders.json().items[0];
      expect(order.isTest).toBe(true);
      expect(await stockOf(current, product.id)).toBe(3);

      const detail = await current.admin("GET", `/shop/orders/${order.id}`);
      expect(detail.json().paymentProvider).toBe("test");
      expect(detail.json().timeline.map((event: { kind: string }) => event.kind)).toContain(
        "test_order",
      );

      const emails = current.server.emailOutbox?.sent ?? [];
      expect(emails.at(-1)?.subject).toMatch(/^Test order: /);
      expect(emails.at(-1)?.text).toContain("This is a test order. No money was taken.");

      const banner = await site.inject({
        method: "GET",
        url: `/order-confirmation?checkout=${checkoutId}`,
        cookies: { [TEST_SESSION_COOKIE]: cookie },
      });
      expect(banner.body).toContain(`Test order ${order.name} placed`);
      expect(banner.body).toContain(`/commerce/orders/${order.id}`);

      const sales = await current.admin("GET", "/shop/sales/summary?days=30");
      expect(sales.json().byCurrency).toEqual([]);
      expect(sales.json().ordersToFulfil).toBe(0);
      const customers = await current.admin("GET", "/shop/customers");
      expect(customers.json().items[0].orderCount).toBe(0);
    },
    SLOW_TEST,
  );

  it(
    "never gives an ordinary visitor the test payment",
    async () => {
      const { current, site, variantId, rateId } = await start({
        STRIPE_SECRET_KEY: "sk_test_fakekey4242",
        STRIPE_PUBLISHABLE_KEY: "pk_test_fakekey4242",
        STRIPE_WEBHOOK_SECRET: "whsec_testsigningsecret",
      });
      const page = await site.inject({ method: "GET", url: "/shop" });
      expect(page.body).not.toContain("data-lintel-test-banner");

      const checkout = await fillBasket(site, variantId, rateId);
      expect(checkout.statusCode).toBe(201);
      expect(checkout.json().provider).toBe("stripe");
      const checkoutId: string = checkout.json().checkoutId;

      expect((await pay(site, checkoutId, undefined)).statusCode).toBe(403);
      const payPage = await site.inject({
        method: "GET",
        url: `/_lintel/shop-test/pay?checkout=${checkoutId}`,
      });
      expect(payPage.statusCode).toBe(403);

      // Even a good session can't pay a real checkout with the test payment.
      const cookie = await openSession(current, site);
      expect((await pay(site, checkoutId, cookie)).statusCode).toBe(404);
      expect((await current.admin("GET", "/shop/orders")).json().total).toBe(0);
    },
    SLOW_TEST,
  );

  it(
    "doesn't let a market choose the test payment",
    async () => {
      const { current, market } = await start();
      const refused = await current.admin("PATCH", `/shop/markets/${market.id}`, {
        paymentProvider: "test",
      });
      expect(refused.statusCode).toBe(400);
    },
    SLOW_TEST,
  );

  it(
    "refuses forged, expired and wrong kinds of token",
    async () => {
      const { current, site, variantId, rateId } = await start();
      const good = await openSession(current, site);

      const forged = signTestToken(
        { kind: "session", userId: USER_ID, expiresAt: Date.now() + 3_600_000 },
        "not the install's secret, but long enough to look like one",
      );
      const tampered = `${good.slice(0, -2)}xx`;
      for (const token of [forged, tampered, "nonsense"]) {
        const refused = await site.inject({
          method: "GET",
          url: `/_lintel/shop-test/start?token=${encodeURIComponent(token)}`,
        });
        expect(refused.statusCode).toBe(403);
        expect(refused.headers["set-cookie"]).toBeUndefined();
        const page = await site.inject({
          method: "GET",
          url: "/shop",
          cookies: { [TEST_SESSION_COOKIE]: token },
        });
        expect(page.body).not.toContain("data-lintel-test-banner");
        const checkout = await fillBasket(site, variantId, rateId, token);
        expect(checkout.statusCode).toBe(403);
        expect(checkout.json().code).toBe("TEST_SESSION_REFUSED");
      }

      // The session's own token can't stand in for the link, or the link's for the session.
      const swapped = await site.inject({
        method: "GET",
        url: `/_lintel/shop-test/start?token=${encodeURIComponent(good)}`,
      });
      expect(swapped.statusCode).toBe(403);

      const link = await current.admin("POST", "/shop/test-session");
      const startUrl = new URL(link.json().url);
      current.clock.advanceMinutes(6);
      const lateLink = await site.inject({
        method: "GET",
        url: `${startUrl.pathname}${startUrl.search}`,
      });
      expect(lateLink.statusCode).toBe(403);

      current.clock.advanceMinutes(120);
      const expired = await fillBasket(site, variantId, rateId, good);
      expect(expired.statusCode).toBe(403);
      const page = await site.inject({
        method: "GET",
        url: "/shop",
        cookies: { [TEST_SESSION_COOKIE]: good },
      });
      expect(page.body).not.toContain("data-lintel-test-banner");
    },
    SLOW_TEST,
  );

  it(
    "keeps a customer who was there before the test, even with no orders",
    async () => {
      const { current, site, variantId, rateId } = await start();
      const [imported] = await insertReturning(testDatabase.database, customersTable, {
        email: "tester@example.com",
        name: "Imported",
        createdAt: new Date(0),
      });
      await placeTestOrder(site, variantId, rateId, await openSession(current, site));

      const deleted = await current.admin("DELETE", "/shop/test-orders");
      expect(deleted.json()).toEqual({ deleted: 1 });

      const customers = await testDatabase.database.select().from(customersTable);
      expect(customers.map((customer) => customer.id)).toEqual([imported?.id]);
    },
    SLOW_TEST,
  );

  it("keeps the two kinds of token apart", () => {
    const secret = "a secret long enough for the test to mean something";
    const launch = signTestToken({ kind: "launch", userId: USER_ID, expiresAt: 2_000 }, secret);
    expect(checkTestToken(launch, "session", secret, new Date(1_000)).status).toBe("invalid");
    expect(checkTestToken(launch, "launch", secret, new Date(1_000)).status).toBe("valid");
    expect(checkTestToken(launch, "launch", secret, new Date(3_000)).status).toBe("expired");
  });

  it(
    "only lets people who run the shop start one",
    async () => {
      const { current } = await start();
      const anonymous = await current.storefront("POST", "/shop/test-session");
      expect(anonymous.statusCode).toBe(401);
    },
    SLOW_TEST,
  );

  it(
    "gives the stock back when the test payment fails",
    async () => {
      const { current, site, variantId, rateId, product } = await start();
      const cookie = await openSession(current, site);
      const checkout = await fillBasket(site, variantId, rateId, cookie);
      const failed = await pay(site, checkout.json().checkoutId, cookie, "failed");
      expect(failed.headers.location).toBe("/cart?test-payment=failed");
      expect((await current.admin("GET", "/shop/orders")).json().total).toBe(0);
      expect(await stockOf(current, product.id)).toBe(5);
      const status = await current.storefront(
        "GET",
        `/delivery/shop/checkouts/${checkout.json().checkoutId}`,
      );
      expect(status.json().status).toBe("expired");
    },
    SLOW_TEST,
  );

  it(
    "deletes test orders in one go, puts stock back and leaves real orders alone",
    async () => {
      const { current, site, variantId, rateId, product } = await start();
      const cookie = await openSession(current, site);
      await placeTestOrder(site, variantId, rateId, cookie);
      await placeTestOrder(site, variantId, rateId, cookie);
      expect(await stockOf(current, product.id)).toBe(1);
      expect((await current.admin("GET", "/shop/test-orders")).json()).toEqual({ count: 2 });

      // One cancelled with its stock back must not be restocked twice.
      const orders = (await current.admin("GET", "/shop/orders")).json().items;
      await current.admin("POST", `/shop/orders/${orders[0].id}/cancel`, {});
      expect(await stockOf(current, product.id)).toBe(3);

      const deleted = await current.admin("DELETE", "/shop/test-orders");
      expect(deleted.json()).toEqual({ deleted: 2 });
      expect(await stockOf(current, product.id)).toBe(5);
      expect((await current.admin("GET", "/shop/orders")).json().total).toBe(0);
      expect((await current.admin("GET", "/shop/customers")).json().total).toBe(0);
      expect((await current.admin("GET", "/shop/settings")).json().nextOrderNumber).toBe(1001);
    },
    SLOW_TEST,
  );

  it(
    "never deletes a real order, or an order number one has used",
    async () => {
      const { current, site, variantId, rateId } = await start({
        STRIPE_SECRET_KEY: "sk_test_fakekey4242",
        STRIPE_PUBLISHABLE_KEY: "pk_test_fakekey4242",
        STRIPE_WEBHOOK_SECRET: "whsec_testsigningsecret",
      });
      const cookie = await openSession(current, site);
      await placeTestOrder(site, variantId, rateId, cookie);

      const checkout = await fillBasket(site, variantId, rateId);
      const { checkoutId, total } = checkout.json();
      await current.sendWebhook({
        id: "evt_real_1",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_real",
            status: "succeeded",
            amount_received: total.amount,
            currency: "gbp",
            metadata: { lintel_checkout_id: checkoutId },
          },
        },
      });
      const sales = await current.admin("GET", "/shop/sales/summary?days=30");
      expect(sales.json().byCurrency[0].orderCount).toBe(1);

      await current.admin("DELETE", "/shop/test-orders");
      const left = await testDatabase.database
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.isTest, false));
      expect(left).toHaveLength(1);
      expect((await current.admin("GET", "/shop/settings")).json().nextOrderNumber).toBe(1003);
    },
    SLOW_TEST,
  );

  it(
    "says what's missing before a test can start",
    async () => {
      shop = await startTestShop(
        testDatabase.database,
        testDatabase.activeDatabase,
        { environment: NO_PAYMENT_ACCOUNT },
        { website: { builtInSiteUrl: "http://localhost:3000" } },
      );
      const refused = await shop.admin("POST", "/shop/test-session");
      expect(refused.statusCode).toBe(409);
      expect(refused.json().message).toContain("Choose where you sell");
    },
    SLOW_TEST,
  );
});
