import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { isPluginEnabled } from "../../plugins/plugins.service.js";
import type { PageCache, SiteResponse } from "../../website/rendered-pages-cache.js";
import type { SiteDependencies } from "../../website/site-pages.service.js";
import { storefrontSources } from "../../website/site-sources.js";
import {
  type BannerMessage,
  TEST_SESSION_END_PATH,
  testPaymentGonePage,
  testPaymentPage,
  testSessionBanner,
  testSessionRefusedPage,
} from "./test-checkout-pages.js";
import { TEST_PAYMENT_PATH } from "./test-payment-provider.js";
import {
  findOpenTestCheckout,
  findTestOrder,
  finishTestPayment,
  testPaymentOutcomes,
} from "./test-payments.service.js";
import {
  checkTestSession,
  openTestSession,
  TEST_SESSION_START_PATH,
} from "./test-session.service.js";
import { TEST_SESSION_COOKIE } from "./test-session-tokens.js";

/**
 * HTTP only, on the website's own server. A test session lives in one browser's cookie, and
 * every step here checks that cookie's signature and time again:
 *
 *   GET  /_lintel/shop-test/start?token=   swaps the admin's link for the cookie, then /shop
 *   GET  /_lintel/shop-test/pay?checkout=  the test payment page
 *   POST /_lintel/shop-test/pay            checkout=&outcome=paid|failed, then back to the site
 *   POST /_lintel/shop-test/end            forgets the cookie
 *
 * The cookie is HttpOnly and SameSite=Lax, so scripts can't read it and another site can't
 * send a shopper's browser here with it. Without a good cookie the pay routes answer 403.
 */

export interface TestCheckoutSiteOptions {
  api: FastifyInstance;
  /** Where the API's routes are on `api`: "" beside the website, "/api" in one process. */
  apiPrefix?: string;
  /** Where the admin is on its origin: "" in development, ADMIN_PATH in production. */
  adminPath?: string;
}

const payFormSchema = z.object({ checkout: z.uuid(), outcome: z.enum(testPaymentOutcomes) });
const checkoutQuerySchema = z.object({ checkout: z.uuid() });
const startQuerySchema = z.object({ token: z.string().min(1).max(2000) });

const HTML = "text/html; charset=utf-8";

export async function testCheckoutSiteRoutes(
  server: FastifyInstance,
  options: TestCheckoutSiteOptions,
) {
  const { api } = options;
  const shop = api.shop;
  server.removeAllContentTypeParsers();
  server.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string", bodyLimit: 4096 },
    (_request, body, done) => done(null, Object.fromEntries(new URLSearchParams(String(body)))),
  );

  const shopIsOn = () => isPluginEnabled(api.database, "commerce");

  const hasGoodSession = async (request: FastifyRequest) => {
    const token = readTestCookie(request);
    return (
      token !== undefined &&
      (await shopIsOn()) &&
      (await checkTestSession(shop, token)).status === "valid"
    );
  };

  server.get(TEST_SESSION_START_PATH, async (request, reply) => {
    const query = startQuerySchema.safeParse(request.query);
    const opened = query.success && (await shopIsOn());
    const session = opened ? await openTestSession(shop, query.data.token) : null;
    if (!session) return refuse(reply, testSessionRefusedPage());
    return reply
      .header("set-cookie", cookie(request, session.token, session.maxAgeSeconds))
      .header("cache-control", "no-store")
      .redirect("/shop", 303);
  });

  server.get(TEST_PAYMENT_PATH, async (request, reply) => {
    if (!(await hasGoodSession(request))) return refuse(reply, testSessionRefusedPage());
    const query = checkoutQuerySchema.safeParse(request.query);
    const checkout = query.success
      ? await findOpenTestCheckout(shop, query.data.checkout)
      : undefined;
    if (!checkout) return reply.code(404).type(HTML).send(testPaymentGonePage());
    return reply.type(HTML).header("cache-control", "no-store").send(testPaymentPage(checkout));
  });

  server.post(TEST_PAYMENT_PATH, async (request, reply) => {
    if (!(await hasGoodSession(request))) return refuse(reply, testSessionRefusedPage());
    const form = payFormSchema.safeParse(request.body);
    const finished = form.success
      ? await finishTestPayment(shop, form.data.checkout, form.data.outcome)
      : "gone";
    if (finished === "gone" || !form.success) {
      return reply.code(404).type(HTML).send(testPaymentGonePage());
    }
    return reply
      .header("cache-control", "no-store")
      .redirect(
        finished === "paid"
          ? `/order-confirmation?checkout=${form.data.checkout}`
          : "/cart?test-payment=failed",
        303,
      );
  });

  server.post(TEST_SESSION_END_PATH, async (request, reply) =>
    reply
      .header("set-cookie", cookie(request, "", 0))
      .header("cache-control", "no-store")
      .redirect("/", 303),
  );
}

function refuse(reply: FastifyReply, html: string) {
  return reply.code(403).type(HTML).header("cache-control", "no-store").send(html);
}

function cookie(request: FastifyRequest, value: string, maxAgeSeconds: number): string {
  const secure = request.protocol === "https" ? "; Secure" : "";
  return `${TEST_SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}

export function readTestCookie(request: FastifyRequest): string | undefined {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const [name, value] = part.trim().split("=");
    if (name === TEST_SESSION_COOKIE && value) return value;
  }
  return undefined;
}

/** One page of a test session, as site.routes.ts needs it. */
export interface TestVisit {
  /** Reads the shop as a test shopper sees it, and keeps nothing in the shared page cache. */
  dependencies(dependencies: SiteDependencies): SiteDependencies;
  /** Adds the banner, and makes sure nothing keeps this version of the page. */
  finish(response: SiteResponse): Promise<SiteResponse>;
}

/** Null for ordinary visitors, who get the site exactly as it is. */
export function testVisitReader(options: TestCheckoutSiteOptions) {
  const { api, apiPrefix = "", adminPath = "" } = options;
  return async function readTestVisit(request: FastifyRequest): Promise<TestVisit | null> {
    const token = readTestCookie(request);
    if (!token || !(await isPluginEnabled(api.database, "commerce"))) return null;
    if ((await checkTestSession(api.shop, token)).status !== "valid") return null;
    const url = new URL(request.url, "http://site.invalid");
    return {
      dependencies: (dependencies) => ({
        ...dependencies,
        sources: storefrontSources(api, apiPrefix, token),
        cache: withoutKeepingPages(dependencies.cache),
      }),
      finish: async (response) => {
        const message = await bannerMessageFor(url, async (checkoutId) => {
          const order = await findTestOrder(api.shop, checkoutId);
          if (!order) return null;
          return {
            name: order.name,
            url: `${api.adminOrigin}${adminPath}/commerce/orders/${encodeURIComponent(order.id)}`,
          };
        });
        return withBanner(response, message);
      },
    };
  };
}

async function bannerMessageFor(
  url: URL,
  findOrder: (checkoutId: string) => Promise<{ name: string; url: string } | null>,
): Promise<BannerMessage> {
  if (url.searchParams.get("test-payment") === "failed") {
    return { text: "The test payment failed, as you asked. No order was placed." };
  }
  const checkoutId = checkoutQuerySchema.safeParse({ checkout: url.searchParams.get("checkout") });
  if (url.pathname.endsWith("/order-confirmation") && checkoutId.success) {
    const order = await findOrder(checkoutId.data.checkout);
    if (order) {
      return {
        text: `Test order ${order.name} placed. No money was taken.`,
        link: { label: "See it in your orders", url: order.url },
      };
    }
  }
  return { text: "Test order: no money is taken" };
}

/** The shared values are the same for everyone; only finished pages differ in a test. */
function withoutKeepingPages(cache: PageCache): PageCache {
  return {
    find: () => undefined,
    store: () => {},
    shareValue: (key, load) => cache.shareValue(key, load),
  };
}

function withBanner(response: SiteResponse, message: BannerMessage): SiteResponse {
  const noStore = Object.fromEntries(
    Object.entries({ ...response.headers, "cache-control": "private, no-store" }).filter(
      ([name]) => name !== "etag",
    ),
  );
  if (!response.headers["content-type"]?.startsWith("text/html")) {
    return { ...response, headers: noStore };
  }
  const banner = testSessionBanner(message);
  const bodyEnd = response.body.lastIndexOf("</body>");
  const body =
    bodyEnd === -1
      ? `${response.body}${banner}`
      : `${response.body.slice(0, bodyEnd)}${banner}${response.body.slice(bodyEnd)}`;
  return { ...response, headers: noStore, body };
}
