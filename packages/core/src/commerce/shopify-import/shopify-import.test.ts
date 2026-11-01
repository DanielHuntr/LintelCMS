import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalDiskStorage } from "../../media/local-disk-storage.js";
import { setEnabledPlugins } from "../../plugins/plugins.service.js";
import { useTestDatabase } from "../../testing/test-database.js";
import { FakeShopifyCdn } from "../testing/fake-shopify-cdn.js";
import { startTestShop, type TestShop } from "../testing/test-shop.js";
import { parseCsv } from "./csv.js";
import { downloadShopifyImage, imageAddressProblem } from "./shopify-images.js";
import { readShopifyProducts } from "./shopify-products.js";
import { updateImportRow } from "./shopify-import.repository.js";

/**
 * Moving a shop from Shopify's CSV exports (fixtures/ holds hand-made ones). The photos come
 * from a fake Shopify CDN, so nothing touches the network.
 */
const SLOW_TEST = 90_000;
const fixture = (name: string) => readFile(join(import.meta.dirname, "fixtures", name), "utf8");

describe("reading Shopify's files", () => {
  it("reads quoted fields across lines, doubled quotes, a BOM and CRLF", async () => {
    const table = parseCsv(await fixture("products.csv"));
    expect(table.columns[0]).toBe("Handle");
    const products = readShopifyProducts(table);
    expect(products.map((product) => product.handle)).toEqual([
      "linen-shirt",
      "canvas-tote",
      "gift-card",
      "wool-socks",
    ]);
    const [shirt, tote] = products;
    expect(shirt?.bodyHtml).toContain('<script>alert("hi")</script>');
    expect(shirt?.options).toEqual([
      { name: "Size", values: ["S", "M"] },
      { name: "Colour", values: ["Sand"] },
    ]);
    expect(shirt?.variants.map((variant) => variant.sku)).toEqual(["LS-S-SAND", "LS-M-SAND"]);
    expect(shirt?.images).toHaveLength(3);
    expect(tote?.options).toEqual([]);
    expect(tote?.status).toBe("draft");
  });

  it("fetches photos only from Shopify's image servers, within the size limit", async () => {
    expect(imageAddressProblem("https://cdn.shopify.com/s/files/1/a.jpg")).toBeNull();
    expect(imageAddressProblem("http://cdn.shopify.com/s/files/1/a.jpg")).toBe(
      "isn't an https:// address",
    );
    expect(imageAddressProblem("https://169.254.169.254/latest/meta-data")).toContain(
      "not Shopify's image server",
    );
    expect(imageAddressProblem("https://cdn.shopify.com.evil.example/a.jpg")).toContain(
      "not Shopify's image server",
    );
    const endless: typeof fetch = async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(new Uint8Array(1024 * 1024));
          },
        }),
        { headers: { "content-type": "image/jpeg" } },
      );
    const tooBig = await downloadShopifyImage(endless, "https://cdn.shopify.com/s/big.jpg");
    expect(tooBig).toEqual({ ok: false, reason: "The photo is larger than 20 MB" });
  });
});

describe("importing from Shopify", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop;
  let cdn: FakeShopifyCdn;
  let mediaFolder: string;

  beforeEach(async () => {
    cdn = new FakeShopifyCdn();
    mediaFolder = await mkdtemp(join(tmpdir(), "lintel-import-"));
    shop = await startTestShop(
      testDatabase.database,
      testDatabase.activeDatabase,
      { importFetch: cdn.fetch },
      {
        media: {
          storage: new LocalDiskStorage(join(mediaFolder, "uploads")),
          transformCacheFolder: join(mediaFolder, "cache"),
        },
      },
    );
    await setEnabledPlugins(testDatabase.database, ["commerce", "seo"]);
    await shop.admin("POST", "/shop/markets", {
      name: "United Kingdom",
      currency: "GBP",
      countries: ["GB"],
    });
  });
  afterEach(async () => {
    await shop.server.close();
    await rm(mediaFolder, { recursive: true, force: true });
  });

  async function startImport() {
    const started = await shop.admin("POST", "/shop/imports/shopify", {
      productsCsv: await fixture("products.csv"),
      customersCsv: await fixture("customers.csv"),
      ordersCsv: await fixture("orders.csv"),
    });
    expect(started.statusCode).toBe(201);
    return started.json();
  }

  const options = {
    productStatus: "keep",
    importImages: true,
    collectionsFromColumn: true,
    tagCollections: ["summer"],
    importCustomers: true,
    importOrders: true,
    productPathPrefix: "/shop/",
  };

  it(
    "previews the files and says where every column goes",
    async () => {
      const wrongFile = await shop.admin("POST", "/shop/imports/shopify", {
        productsCsv: await fixture("customers.csv"),
      });
      expect(wrongFile.statusCode).toBe(400);
      expect(wrongFile.json().message).toContain("doesn't look like Shopify's products export");

      const preview = await startImport();
      expect(preview).toMatchObject({
        status: "ready",
        currency: "GBP",
        counts: {
          products: 4,
          variants: 6,
          images: 5,
          customers: 3,
          orders: 2,
          collectionsInFile: ["Summer Edit"],
        },
        options: { collectionsFromColumn: true, importCustomers: true, importOrders: true },
      });
      expect(preview.counts.tags[0]).toEqual({ tag: "summer", products: 2 });
      expect(preview.mapping).toContainEqual({
        file: "products",
        column: "Variant Price",
        field: "price",
      });
      expect(preview.notImported).toContainEqual({
        file: "products",
        column: "Google Shopping / Gender",
      });
      expect(preview.notImported).toContainEqual({
        file: "customers",
        column: "Accepts Email Marketing",
      });
      expect(preview.warnings).toEqual([
        "1 gift card isn't imported: Lintel doesn't sell gift cards yet.",
        "1 photo isn't on Shopify's image server, so it will be skipped. Add it in the product editor afterwards.",
      ]);
      expect(preview.samples[0]).toMatchObject({
        handle: "linen-shirt",
        variants: 2,
        price: "45.00",
      });
    },
    SLOW_TEST,
  );

  it(
    "runs a dry run that saves and downloads nothing",
    async () => {
      const { id } = await startImport();
      await shop.admin("PUT", `/shop/imports/${id}/options`, options);
      const dry = await shop.admin("POST", `/shop/imports/${id}/dry-run`);
      expect(dry.statusCode).toBe(200);
      expect(dry.json().dryRunReport).toMatchObject({
        products: { created: 3, skipped: 1, failed: 0 },
        collections: { created: 2 },
        customers: { created: 2, failed: 1 },
        orders: { created: 2 },
        images: { downloaded: 4, skipped: 1 },
      });
      expect(cdn.requested).toEqual([]);
      expect((await shop.admin("GET", "/shop/products")).json().total).toBe(0);
      expect(dry.json().status).toBe("ready");
    },
    SLOW_TEST,
  );

  it(
    "imports in batches, carries on after a pause, and reports everything",
    async () => {
      const { id } = await startImport();
      await shop.admin("PUT", `/shop/imports/${id}/options`, options);

      const first = await shop.admin("POST", `/shop/imports/${id}/run`, { maxItems: 2 });
      expect(first.json()).toMatchObject({ status: "importing", stage: "products", done: 2 });
      expect(first.json().total).toBe(4 + 2 + 3 + 2);

      // Another window holding the import is told so; once its hold runs out, work goes on.
      await updateImportRow(testDatabase.database, id, {
        leaseUntil: new Date(shop.clock.now.getTime() + 60_000),
      });
      const busy = await shop.admin("POST", `/shop/imports/${id}/run`, { maxItems: 2 });
      expect(busy.statusCode).toBe(409);
      shop.clock.advanceMinutes(2);
      expect((await shop.admin("GET", `/shop/imports/${id}`)).json().paused).toBe(true);

      let current = (await shop.admin("POST", `/shop/imports/${id}/run`, { maxItems: 3 })).json();
      expect(current.done).toBe(5);
      while (current.status !== "completed") {
        current = (await shop.admin("POST", `/shop/imports/${id}/run`)).json();
      }
      expect(current.report).toMatchObject({
        products: { created: 3, skipped: 1, failed: 0 },
        collections: { created: 2, skipped: 0 },
        customers: { created: 2, skipped: 0, failed: 1 },
        orders: { created: 2, skipped: 0 },
        images: { downloaded: 2, skipped: 3 },
        redirects: [
          { fromPath: "/products/linen-shirt", toPath: "/shop/linen-shirt" },
          { fromPath: "/products/canvas-tote", toPath: "/shop/canvas-tote" },
          { fromPath: "/products/wool-socks", toPath: "/shop/wool-socks" },
        ],
      });
      const problems = current.report.problems.map(
        (problem: { message: string }) => problem.message,
      );
      expect(problems).toContain(
        "A photo was skipped: it is on example.com, not Shopify's image server, so it wasn't downloaded.",
      );
      expect(problems).toContain(
        "A photo was skipped: The photo is on images.example.net, not Shopify's image server, so it wasn't downloaded.",
      );
      expect(problems).toContain("A photo was skipped: The photo is larger than 20 MB.");
      expect(problems).toContain("Gift cards aren't imported. Lintel doesn't sell gift cards yet.");
      expect(
        cdn.requested.every((address) => new URL(address).hostname === "cdn.shopify.com"),
      ).toBe(true);

      // The products, as the admin sees them.
      const products = (await shop.admin("GET", "/shop/products?perPage=10")).json();
      expect(products.total).toBe(3);
      const shirtSummary = products.items.find(
        (item: { handle: string }) => item.handle === "linen-shirt",
      );
      const shirt = (await shop.admin("GET", `/shop/products/${shirtSummary.id}`)).json();
      expect(shirt).toMatchObject({
        title: "Linen Shirt",
        status: "active",
        vendor: "Harbour Linen",
        tags: ["summer", "linen"],
        options: [
          { name: "Size", values: ["S", "M"] },
          { name: "Colour", values: ["Sand"] },
        ],
        seoTitle: "Linen Shirt | Harbour",
      });
      expect(shirt.mediaIds).toHaveLength(2);
      expect(JSON.stringify(shirt.description)).not.toContain("alert");
      expect(shirt.description.content[1].type).toBe("bulletList");
      expect(shirt.variants[0]).toMatchObject({
        sku: "LS-S-SAND",
        barcode: "5012345678900",
        weightGrams: 300,
        prices: [{ currency: "GBP", amount: 4500, compareAtAmount: 5500 }],
        available: 4,
      });

      const collections = (await shop.admin("GET", "/shop/collections")).json().collections;
      expect(
        collections.map((item: { title: string; kind: string; productCount: number }) => [
          item.title,
          item.kind,
          item.productCount,
        ]),
      ).toEqual(
        expect.arrayContaining([
          ["Summer Edit", "manual", 2],
          ["summer", "automatic", 2],
        ]),
      );

      // Customers, and their old orders as records.
      const customers = (await shop.admin("GET", "/shop/customers")).json();
      expect(customers.total).toBe(2);
      const ada = customers.items.find(
        (item: { email: string }) => item.email === "ada@example.com",
      );
      const archived = (
        await shop.admin("GET", `/shop/archived-orders?customerId=${ada.id}`)
      ).json();
      expect(archived.items).toEqual([
        expect.objectContaining({
          name: "#1001",
          total: { amount: 8695, currency: "GBP" },
          itemCount: 2,
          discountCodes: ["SPRING10"],
          placedAt: "2026-03-01T10:14:02.000Z",
        }),
      ]);
      const grace = (await shop.admin("GET", "/shop/archived-orders")).json().items[0];
      expect(grace).toMatchObject({
        name: "#1002",
        paymentStatus: "refunded",
        placedAt: "2026-04-12T20:40:00.000Z",
      });
      // Archived orders never become orders Lintel could refund.
      expect((await shop.admin("GET", "/shop/orders")).json().total).toBe(0);

      // The redirects wait in the SEO plugin's list as suggestions.
      const redirects = (await shop.admin("GET", "/seo/redirects")).json();
      expect(redirects.redirects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fromPath: "/products/linen-shirt", status: "suggested" }),
        ]),
      );

      // Running it again does nothing more: everything already there is skipped.
      const again = await startImport();
      await shop.admin("PUT", `/shop/imports/${again.id}/options`, options);
      let repeat = (await shop.admin("POST", `/shop/imports/${again.id}/run`)).json();
      while (repeat.status !== "completed") {
        repeat = (await shop.admin("POST", `/shop/imports/${again.id}/run`)).json();
      }
      expect(repeat.report).toMatchObject({
        products: { created: 0, skipped: 4 },
        customers: { created: 0, skipped: 2 },
        orders: { created: 0, skipped: 2 },
      });
    },
    SLOW_TEST,
  );
});
