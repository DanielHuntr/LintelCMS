import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestShop, stockTheShop, type TestShop } from "../commerce/testing/test-shop.js";
import { startPublish } from "../publishing/publish-runs.service.js";
import { findPublishTargetRow, readSecrets } from "../publishing/publishing.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { openEnvelope } from "./bridge-signing.js";
import { pullFromBridge } from "./bridge-pull.service.js";
import type { ShopCatalogue } from "./shop-catalogue.service.js";

describe("the shop on a site published as files", { timeout: 120_000 }, () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop;
  let folder = "";

  beforeEach(async () => {
    folder = mkdtempSync(join(tmpdir(), "lintel-bridge-shop-"));
    shop = await startTestShop(
      testDatabase.database,
      testDatabase.activeDatabase,
      {},
      {
        lintelFolder: {
          dataFolder: join(folder, "lintel", "data"),
          configFile: join(folder, "lintel", "config.json"),
        },
        website: { builtInSiteUrl: "https://shop.example.com" },
      },
    );
  }, 60_000);

  afterEach(async () => {
    await shop.server.close();
    rmSync(folder, { recursive: true, force: true });
  });

  async function publishToFolder() {
    const created = await shop.admin("POST", "/publishing/targets", {
      name: "Shared hosting",
      kind: "folder",
      options: { folderPath: join(folder, "public_html"), siteAddress: "https://shop.example.com" },
    });
    expect(created.statusCode, created.body).toBe(201);
    const targetId = (created.json() as { id: string }).id;
    const run = await (
      await startPublish(shop.server.publishing, targetId, { trigger: "manual" })
    ).finished;
    expect(run.status, run.errorMessage ?? "").toBe("succeeded");
    return findPublishTargetRow(testDatabase.database, targetId);
  }

  it("publishes even before the shop sells anywhere, leaving the shop out", async () => {
    await publishToFolder();
    expect(existsSync(join(folder, "public_html", "shop"))).toBe(false);
    expect(existsSync(join(folder, "lintel-private", "catalogue.json"))).toBe(false);
  });

  it("publishes product pages and a signed catalogue, and takes the companion's orders into Orders", async () => {
    const stocked = await stockTheShop(shop, { stock: 5 });
    const target = await publishToFolder();
    const secret = readSecrets(shop.server.publishing.secretBox(), target).bridgeSecret ?? "";

    expect(
      readFileSync(join(folder, "public_html", "shop", "linen-shirt", "index.html"), "utf8"),
    ).toContain("Add to basket");
    expect(existsSync(join(folder, "public_html", "shop", "basket", "index.html"))).toBe(true);
    const catalogue = openEnvelope(
      secret,
      readFileSync(join(folder, "lintel-private", "catalogue.json"), "utf8"),
    ) as ShopCatalogue;
    const variant = catalogue.variants[stocked.variantId];
    expect(variant?.prices[stocked.market.id]).toBe(4500);
    expect(variant?.stock).toBe(5);

    const order = {
      id: "0123456789abcdef01234567",
      provider: "stripe",
      providerPaymentId: "pi_bridge",
      paidAt: "2026-11-01T10:05:00.000Z",
      paidAmount: 9495,
      paidCurrency: "GBP",
      matches: true,
      email: "ada@example.com",
      shippingAddress: {
        name: "Ada Lovelace",
        line1: "1 High Street",
        city: "Bath",
        postalCode: "BA1 1AA",
        country: "GB",
      },
      marketId: stocked.market.id,
      currency: "GBP",
      paymentProvider: "stripe",
      lines: [
        {
          variantId: stocked.variantId,
          productId: stocked.product.id,
          productTitle: "Linen shirt",
          variantTitle: "M",
          sku: "SHIRT-M",
          imageId: null,
          quantity: 2,
          unitAmount: 4500,
          subtotalAmount: 9000,
          discountAmount: 0,
          taxAmount: 0,
          weightGrams: 300,
        },
      ],
      shippingLine: { rateId: stocked.rateId, name: "Standard", amount: 495, taxAmount: 0 },
      discounts: [],
      subtotalAmount: 9000,
      discountAmount: 0,
      shippingAmount: 495,
      taxAmount: 0,
      totalAmount: 9495,
      taxesIncluded: false,
    };
    const acknowledged: string[] = [];
    const companion: typeof fetch = async (input, init) => {
      const action = new URL(String(input)).searchParams.get("action");
      if (action === "ack") acknowledged.push(String(init?.body));
      return new Response(
        JSON.stringify(
          action === "pull" ? { submissions: [], orders: [order] } : { acknowledged: 1 },
        ),
      );
    };

    expect((await pullFromBridge(shop.server, target, secret, companion)).orders).toBe(1);
    // Asking again (an acknowledgement lost on the way) never makes a second order.
    expect((await pullFromBridge(shop.server, target, secret, companion)).orders).toBe(0);
    expect(acknowledged[0]).toContain(order.id);

    const orders = await shop.admin("GET", "/shop/orders");
    const listed = (orders.json() as { items: Array<{ email: string }> }).items;
    expect(listed).toHaveLength(1);
    expect(listed[0]?.email).toBe("ada@example.com");
    const product = await shop.admin("GET", `/shop/products/${stocked.product.id}`);
    expect(JSON.stringify(product.json())).toContain('"onHand":3');
  });
});
