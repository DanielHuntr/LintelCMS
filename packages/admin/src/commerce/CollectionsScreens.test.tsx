import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { ProductCollection } from "./collections.api.js";
import { CollectionEditorPage } from "./CollectionEditorPage.js";
import { CollectionsPage } from "./CollectionsPage.js";
import type { Product } from "./products.api.js";
import { ProductEditorPage } from "./ProductEditorPage.js";

/*
 * Shop → Collections: list, make and change collections with the existing collections API,
 * and choose a product's collections from its editor (LINTEL-FUNC-007).
 */

afterEach(() => vi.restoreAllMocks());

const withShop = { enabledPlugins: ["commerce"] };

const summerEdit: ProductCollection = {
  id: "col-1",
  title: "Summer Edit",
  handle: "summer-edit",
  description: "",
  kind: "manual",
  productCount: 1,
  rules: [],
  matchAll: true,
  productIds: ["p-other"],
};

const summerTag: ProductCollection = {
  ...summerEdit,
  id: "col-2",
  title: "Summer tag",
  handle: "summer-tag",
  kind: "automatic",
  rules: [{ field: "tag", operator: "equals", value: "summer" }],
  productIds: ["p1"],
};

const summary = ({ rules: _rules, matchAll: _all, productIds: _ids, ...rest }: ProductCollection) =>
  rest;

const shirt: Product = {
  id: "p1",
  title: "Linen shirt",
  handle: "linen-shirt",
  description: null,
  status: "active",
  vendor: "",
  productType: "",
  tags: [],
  mediaIds: [],
  seoTitle: "",
  seoDescription: "",
  options: [],
  variants: [
    {
      id: "v1",
      title: "Default",
      optionValues: [],
      sku: null,
      barcode: null,
      weightGrams: 0,
      inventoryTracked: false,
      prices: [{ currency: "GBP", amount: 4500, compareAtAmount: null }],
      stock: [],
      available: null,
      held: 0,
    },
  ],
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
};

const ukMarket = {
  id: "m1",
  name: "United Kingdom",
  handle: "united-kingdom",
  currency: "GBP",
  countries: ["GB"],
  isPrimary: true,
  exchangeRate: 1,
  priceRounding: "exact",
  pricesIncludeTax: true,
  paymentProvider: "stripe",
};

describe("Shop → Collections", () => {
  it("lists collections, saying how each picks its products", async () => {
    mockApi(({ url }) =>
      url.pathname === "/shop/collections"
        ? { collections: [summary(summerEdit), summary(summerTag)] }
        : undefined,
    );
    renderScreen(<CollectionsPage />, withShop);

    expect(await screen.findByRole("link", { name: /Summer Edit/ })).toHaveAttribute(
      "href",
      "/commerce/collections/col-1",
    );
    expect(screen.getByText("1 product, picked by hand")).toBeInTheDocument();
    expect(screen.getByText("1 product, picked by rules")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add collection" })).toBeInTheDocument();
  });

  it("makes a collection of the products chosen", async () => {
    const { calls } = mockApi(({ url, method, body }) => {
      if (url.pathname === "/shop/products") {
        return { items: [{ id: "p1", title: "Linen shirt" }], total: 1 };
      }
      if (url.pathname === "/shop/collections" && method === "POST") {
        return { ...summerEdit, ...(body as object), id: "col-9" };
      }
      return undefined;
    });
    renderScreen(<CollectionEditorPage collectionId="new" />, withShop);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect(screen.getByText("Please give the collection a title")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Title"), "Linen edit");
    await user.click(await screen.findByRole("checkbox", { name: "Linen shirt" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() =>
      expect(calls.find((call) => call.method === "POST")?.body).toEqual({
        title: "Linen edit",
        description: "",
        kind: "manual",
        rules: [],
        matchAll: true,
        productIds: ["p1"],
      }),
    );
  });

  it("keeps an automatic collection's rules when its title changes", async () => {
    const { calls } = mockApi(({ url, method, body }) => {
      if (url.pathname === "/shop/collections/col-2" && method === "PUT") {
        return { ...summerTag, ...(body as object) };
      }
      if (url.pathname === "/shop/collections/col-2") return summerTag;
      return undefined;
    });
    renderScreen(<CollectionEditorPage collectionId="col-2" />, withShop);
    const user = userEvent.setup();

    expect(await screen.findByText(/picks its products by its rules/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Title"), " 2026");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() =>
      expect(calls.find((call) => call.method === "PUT")?.body).toMatchObject({
        title: "Summer tag 2026",
        kind: "automatic",
        rules: summerTag.rules,
      }),
    );
  });
});

describe("a product's collections", () => {
  it("puts the product into the hand-picked collections ticked, when it's saved", async () => {
    const { calls } = mockApi(({ url, method, body }) => {
      if (url.pathname === "/shop/products/p1" && method === "PUT") return shirt;
      if (url.pathname === "/shop/products/p1") return shirt;
      if (url.pathname === "/shop/locations") return { locations: [] };
      if (url.pathname === "/shop/markets") return { markets: [ukMarket] };
      if (url.pathname === "/shop/collections") {
        return { collections: [summary(summerEdit), summary(summerTag)] };
      }
      if (url.pathname === "/shop/collections/col-1" && method === "PUT") {
        return { ...summerEdit, ...(body as object) };
      }
      if (url.pathname === "/shop/collections/col-1") return summerEdit;
      return undefined;
    });
    renderScreen(<ProductEditorPage productId="p1" />, withShop);
    const user = userEvent.setup();

    const summer = await screen.findByRole("checkbox", { name: "Summer Edit" });
    expect(summer).not.toBeChecked();
    // Automatic collections pick by their rules, so they aren't offered.
    expect(screen.queryByRole("checkbox", { name: "Summer tag" })).not.toBeInTheDocument();
    await user.click(summer);
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]!);

    await vi.waitFor(() =>
      expect(
        calls.find(
          (call) => call.method === "PUT" && call.url.pathname === "/shop/collections/col-1",
        )?.body,
      ).toMatchObject({ title: "Summer Edit", productIds: ["p-other", "p1"] }),
    );
  });
});
