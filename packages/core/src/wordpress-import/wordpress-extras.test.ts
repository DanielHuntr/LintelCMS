import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { setEnabledPlugins } from "../plugins/plugins.service.js";
import { redirectsTable } from "../seo/seo.table.js";
import { multipartFiles } from "../testing/multipart.js";
import { useDataToolsTestServer } from "../testing/test-data-tools.js";
import { useTestDatabase } from "../testing/test-database.js";
import { convertCustomField, readList } from "./wordpress-custom-fields.js";
import { onThisSite } from "./wordpress-menus.js";
import { parseWordPressExport } from "./wxr-parser.js";

/**
 * The parts of a WordPress site beyond posts and pages: custom fields (Advanced Custom
 * Fields), menus and WooCommerce products. fixtures/garden-shop.xml is a made-up shop.
 */
const gardenShop = readFileSync(new URL("./fixtures/garden-shop.xml", import.meta.url));

describe("reading the extras in a WordPress export", () => {
  const site = parseWordPressExport(gardenShop.toString("utf8"));

  it("reads custom fields, telling Advanced Custom Fields' own apart", () => {
    const visit = site.items.find((item) => item.slug === "visit-us");
    expect(visit?.customFields).toEqual({
      opening_note: "Closed on Christmas Day",
      parking_spaces: "12",
      reopens_on: "20250102",
    });
    expect(visit?.acfKeys.sort()).toEqual(["opening_note", "parking_spaces"]);
  });

  it("reads menus with their nesting, and products with variations", () => {
    expect(site.menus).toHaveLength(1);
    expect(site.menus[0]?.links.map((link) => [link.id, link.parentId, link.linkType])).toEqual([
      ["60", "0", "post_type"],
      ["61", "60", "post_type"],
      ["62", "0", "custom"],
    ]);
    const gloves = site.products.find((product) => product.slug === "garden-gloves");
    expect(gloves?.optionNames).toEqual(["Size"]);
    expect(gloves?.variations.map((variation) => variation.optionValues)).toEqual([
      ["Small"],
      ["Large"],
    ]);
    expect(site.ignoredItemTypes).toEqual({});
  });

  it("reads custom field text as what each field holds", () => {
    const lookups = { attachment: (id: string) => (id === "9" ? "asset-9" : undefined) };
    const field = (type: string, options: Record<string, unknown> = {}) => ({
      handle: "value",
      label: "Value",
      type,
      required: false,
      helpText: "",
      options,
    });
    expect(convertCustomField("20250102", field("date"), lookups)).toBe("2025-01-02");
    expect(convertCustomField("12", field("number"), lookups)).toBe(12);
    expect(convertCustomField("1", field("toggle"), lookups)).toBe(true);
    expect(convertCustomField("9", field("image"), lookups)).toBe("asset-9");
    expect(convertCustomField("ten", field("number"), lookups)).toBeUndefined();
    expect(readList('a:2:{i:0;s:3:"red";i:1;s:4:"blue";}')).toEqual(["red", "blue"]);
    expect(onThisSite("https://www.fernleaf.example/delivery/", "https://fernleaf.example")).toBe(
      "/delivery/",
    );
  });
});

describe("importing the extras from WordPress", { timeout: 60_000 }, () => {
  const testDatabase = useTestDatabase();
  const tools = useDataToolsTestServer(testDatabase);

  async function upload() {
    const response = await tools.server.inject({
      method: "POST",
      url: "/wordpress-imports",
      cookies: tools.cookies,
      ...multipartFiles([{ fieldName: "export", filename: "shop.xml", contents: gardenShop }]),
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json<{ id: string; found: Record<string, unknown> }>();
  }

  async function addPageFields() {
    const page = (await tools.api("GET", "/blueprints/page")).json<{
      name: string;
      fields: unknown[];
    }>();
    await tools.api("PUT", "/blueprints/page", {
      name: page.name,
      fields: [
        ...page.fields,
        { handle: "opening_note", label: "Opening note", type: "text", options: {} },
        { handle: "parking_spaces", label: "Parking spaces", type: "number", options: {} },
      ],
    });
  }

  it("maps custom fields, makes the menu and brings products into the shop", async () => {
    await addPageFields();
    await setEnabledPlugins(testDatabase.database, tools.server.plugins, ["commerce"]);
    await tools.api("POST", "/shop/markets", {
      name: "United Kingdom",
      currency: "GBP",
      countries: ["GB"],
      pricesIncludeTax: false,
    });
    const created = await upload();
    expect(created.found).toMatchObject({ pages: 2, menus: 1, products: 2 });

    const choices = (await tools.api("GET", `/wordpress-imports/${created.id}/mapping`)).json<{
      suggested: { pageFields: Record<string, string | null> };
      shopEnabled: boolean;
      collectionFields: Record<string, Array<{ handle: string }>>;
    }>();
    expect(choices.shopEnabled).toBe(true);
    // Same handles are matched; the date has no field yet, so it is left out.
    expect(choices.suggested.pageFields).toEqual({
      opening_note: "opening_note",
      parking_spaces: "parking_spaces",
      reopens_on: null,
    });
    const wrong = await tools.api("PUT", `/wordpress-imports/${created.id}/mapping`, {
      ...choices.suggested,
      pageFields: { reopens_on: "no_such_field" },
    });
    expect(wrong.statusCode).toBe(400);
    await tools.api("PUT", `/wordpress-imports/${created.id}/mapping`, choices.suggested);

    const dryRun = (await tools.api("POST", `/wordpress-imports/${created.id}/dry-run`)).json<{
      counts: Record<string, { done: number }>;
    }>();
    expect(dryRun.counts.product?.done).toBe(2);
    expect(dryRun.counts.menu?.done).toBe(1);
    expect((await tools.api("GET", "/shop/products")).json().items).toEqual([]);

    await tools.api("POST", `/wordpress-imports/${created.id}/start`);
    await tools.server.dataTools.tasks.finishAll();
    const finished = (await tools.api("GET", `/wordpress-imports/${created.id}`)).json<{
      status: string;
      report: { problems: unknown[] };
    }>();
    expect(finished.status).toBe("complete");
    expect(finished.report.problems).toEqual([]);

    const pages = (await tools.api("GET", "/collections/pages/entries")).json<{
      entries: Array<{ id: string; slug: string; parentId: string | null }>;
    }>().entries;
    const visit = pages.find((page) => page.slug === "visit-us");
    expect(pages.find((page) => page.slug === "seed-sowing-guide")?.parentId).toBe(visit?.id);
    const visitEntry = (await tools.api("GET", `/entries/${visit?.id}`)).json<{
      data: Record<string, unknown>;
    }>();
    expect(visitEntry.data).toMatchObject({
      opening_note: "Closed on Christmas Day",
      parking_spaces: 12,
    });

    const menu = (await tools.api("GET", "/navigation/footer_links")).json<{
      items: Array<{ entryId: string | null; url: string | null; children: unknown[] }>;
    }>();
    expect(menu.items).toHaveLength(2);
    expect(menu.items[0]?.entryId).toBe(visit?.id);
    expect(menu.items[0]?.children).toHaveLength(1);
    expect(menu.items[1]?.url).toBe("/delivery/");

    const products = (await tools.api("GET", "/shop/products")).json<{
      items: Array<{ id: string; handle: string }>;
    }>().items;
    expect(products.map((product) => product.handle).sort()).toEqual([
      "garden-gloves",
      "watering-can",
    ]);
    const can = (
      await tools.api(
        "GET",
        `/shop/products/${products.find((p) => p.handle === "watering-can")?.id}`,
      )
    ).json<{
      variants: Array<{ sku: string; prices: Array<{ amount: number; compareAtAmount: number }> }>;
    }>();
    expect(can.variants[0]).toMatchObject({
      sku: "CAN-01",
      prices: [expect.objectContaining({ amount: 1500, compareAtAmount: 1850 })],
    });

    const redirects = await testDatabase.database.select().from(redirectsTable);
    expect(redirects.map((redirect) => [redirect.fromPath, redirect.toPath]).sort()).toEqual([
      ["/product/garden-gloves", "/products/garden-gloves"],
      ["/product/watering-can", "/products/watering-can"],
      ["/visit-us", "/"],
      ["/visit-us/seed-sowing-guide", "/seed-sowing-guide"],
    ]);
  });

  it("leaves products out, and says why, while the shop is switched off", async () => {
    const created = await upload();
    await tools.api("PUT", `/wordpress-imports/${created.id}/mapping`, {});
    const dryRun = (await tools.api("POST", `/wordpress-imports/${created.id}/dry-run`)).json<{
      counts: Record<string, { done: number; skipped: number }>;
    }>();
    expect(dryRun.counts.product).toMatchObject({ done: 0, skipped: 2 });
  });
});
