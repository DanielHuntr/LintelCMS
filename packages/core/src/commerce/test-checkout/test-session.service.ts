import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { HttpError } from "../../http/http-errors.js";
import { findSigningSecret } from "../../preview/preview.service.js";
import type { ShopContext } from "../commerce.context.js";
import { ShopNotReadyError } from "../commerce.errors.js";
import { listMarketRows } from "../markets/markets.repository.js";
import { listProductRows } from "../products/products.repository.js";
import { listRateRows, listZoneRows } from "../shipping/shipping.repository.js";
import {
  checkTestToken,
  LAUNCH_TOKEN_LIFETIME_MS,
  SESSION_TOKEN_LIFETIME_MS,
  signTestToken,
  type TestTokenCheck,
} from "./test-session-tokens.js";

export const TEST_SESSION_START_PATH = "/_lintel/shop-test/start";

/**
 * "Try your shop": someone who runs the shop opens the website as a test shopper. Only this
 * browser is affected, for two hours at most. See test-session-tokens.ts.
 */

export class TestSessionRefusedError extends HttpError {
  constructor() {
    super(
      403,
      "TEST_SESSION_REFUSED",
      "This test session has ended. Open Try your shop in the admin to start a new one.",
    );
  }
}

/** The link that starts a test session, for the person who asked. */
export async function startTestSession(
  shop: ShopContext,
  userId: string,
  websiteAddress: string | null,
): Promise<{ url: string; expiresAt: string }> {
  if (!websiteAddress) {
    throw new ShopNotReadyError(
      "Try your shop works on Lintel's built-in website, and this site doesn't use it.",
    );
  }
  await refuseUnreadyShop(shop);
  const expiresAt = shop.now().getTime() + LAUNCH_TOKEN_LIFETIME_MS;
  const token = signTestToken(
    { kind: "launch", userId, expiresAt },
    await findSigningSecret(shop.database),
  );
  const url = new URL(TEST_SESSION_START_PATH, websiteAddress);
  url.searchParams.set("token", token);
  return { url: url.toString(), expiresAt: new Date(expiresAt).toISOString() };
}

/** What a test order needs: somewhere to sell, a way to deliver, and something to buy. */
async function refuseUnreadyShop(shop: ShopContext): Promise<void> {
  const markets = await listMarketRows(shop.database, DEFAULT_TENANT_ID);
  if (markets.length === 0) {
    throw new ShopNotReadyError("Choose where you sell first, then try your shop.");
  }
  const zones = await listZoneRows(shop.database, DEFAULT_TENANT_ID);
  const rates = await listRateRows(
    shop.database,
    zones.map((zone) => zone.id),
  );
  if (rates.length === 0) {
    throw new ShopNotReadyError("Add a delivery price first, then try your shop.");
  }
  const { total } = await listProductRows(
    shop.database,
    DEFAULT_TENANT_ID,
    { status: "active" },
    { page: 1, perPage: 1 },
  );
  if (total === 0) {
    throw new ShopNotReadyError("Add a product and make it active first, then try your shop.");
  }
}

/** Swaps the link's token for the cookie's, or says no. */
export async function openTestSession(
  shop: ShopContext,
  launchToken: string,
): Promise<{ token: string; maxAgeSeconds: number } | null> {
  const secret = await findSigningSecret(shop.database);
  const launch = checkTestToken(launchToken, "launch", secret, shop.now());
  if (launch.status !== "valid") return null;
  const token = signTestToken(
    {
      kind: "session",
      userId: launch.payload.userId,
      expiresAt: shop.now().getTime() + SESSION_TOKEN_LIFETIME_MS,
    },
    secret,
  );
  return { token, maxAgeSeconds: SESSION_TOKEN_LIFETIME_MS / 1000 };
}

export async function checkTestSession(shop: ShopContext, token: string): Promise<TestTokenCheck> {
  return checkTestToken(token, "session", await findSigningSecret(shop.database), shop.now());
}

/** For reading the catalogue: a bad token only means an ordinary visitor. */
export async function isTestSession(
  shop: ShopContext,
  token: string | undefined,
): Promise<boolean> {
  return token !== undefined && (await checkTestSession(shop, token)).status === "valid";
}

/**
 * For starting a checkout. A token that doesn't pass is refused outright rather than treated
 * as an ordinary visitor, so someone who thinks they're testing is never sent to a real
 * payment page by accident. No token at all is an ordinary shopper.
 */
export async function requireGoodTestSession(
  shop: ShopContext,
  token: string | undefined,
): Promise<boolean> {
  if (token === undefined) return false;
  if ((await checkTestSession(shop, token)).status !== "valid") {
    throw new TestSessionRefusedError();
  }
  return true;
}
