import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { DiscountEditorPage } from "./DiscountEditorPage.js";
import type { PaymentProviders } from "./paymentProviders.api.js";
import { PaymentsPage } from "./PaymentsPage.js";
import type { PaymentSettings } from "./shopSettings.api.js";
import type { ShopifyImport } from "./shopifyImport.api.js";
import { ShopifyImportPage } from "./ShopifyImportPage.js";

afterEach(() => vi.restoreAllMocks());

const withShop = { enabledPlugins: ["commerce"] };
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

describe("the discount editor", () => {
  it("sums the discount up as it's set, and saves it", async () => {
    const { calls } = mockApi(({ url, method, body }) => {
      if (url.pathname === "/shop/markets") return { markets: [ukMarket] };
      if (url.pathname === "/shop/products") return { items: [], total: 0 };
      if (url.pathname === "/shop/collections") return { collections: [] };
      if (url.pathname === "/shop/discounts" && method === "POST") {
        return { ...(body as object), id: "d1", status: "active", usageCount: 0 };
      }
      return undefined;
    });
    renderScreen(<DiscountEditorPage discountId="new" />, withShop);

    expect(
      await screen.findByRole("heading", { level: 1, name: "New discount" }),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Code"), "summer20");
    await user.type(screen.getByLabelText("Name"), "Summer sale");
    const percent = screen.getByLabelText("How much off, in %");
    await user.clear(percent);
    await user.type(percent, "20");
    await user.click(screen.getByRole("radio", { name: "Spend" }));
    await user.type(screen.getByLabelText("Minimum spend (£, GBP)"), "50");

    expect(screen.getByText("20% off everything, orders of £50 or more")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() =>
      expect(calls.find((call) => call.method === "POST")?.body).toMatchObject({
        title: "Summer sale",
        method: "code",
        code: "SUMMER20",
        kind: "percentage",
        percentOff: 20,
        minimumSpend: { GBP: 5000 },
      }),
    );
  });

  it("explains what's missing before saving", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/shop/markets") return { markets: [ukMarket] };
      if (url.pathname === "/shop/products") return { items: [], total: 0 };
      if (url.pathname === "/shop/collections") return { collections: [] };
      return undefined;
    });
    renderScreen(<DiscountEditorPage discountId="new" />, withShop);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText("Please give the discount a name")).toBeInTheDocument();
    expect(screen.getByText("Please enter the code shoppers will type")).toBeInTheDocument();
  });
});

const stripeConnected: PaymentSettings = {
  connected: true,
  mode: "test",
  secretKey: { hint: "sk_test_…4242", source: "admin" },
  publishableKey: { value: "pk_test_abc", source: "admin" },
  webhookSecret: { source: "admin" },
  webhookUrl: "https://shop.example.com/shop/stripe/webhook",
  webhookEvents: ["checkout.session.completed"],
  checkoutMode: "hosted",
};

const providers: PaymentProviders = {
  paypal: {
    connected: false,
    mode: null,
    source: null,
    clientIdHint: null,
    webhookIdSet: false,
    webhookUrl: "https://shop.example.com/shop/paypal/webhook",
    webhookEvents: ["CHECKOUT.ORDER.APPROVED", "PAYMENT.CAPTURE.COMPLETED"],
  },
  mollie: { connected: false, mode: null, source: null, apiKeyHint: null, webhookUrl: null },
  markets: [{ id: "m1", name: "United Kingdom", currency: "GBP", paymentProvider: "stripe" }],
};

describe("connecting PayPal", () => {
  it("guides through PayPal's steps and saves the app's details", async () => {
    const { calls } = mockApi(({ url, method }) => {
      if (url.pathname === "/shop/settings/payments") return stripeConnected;
      if (url.pathname === "/shop/settings/payment-providers/paypal" && method === "PUT") {
        return {
          ...providers,
          paypal: { ...providers.paypal, connected: true, mode: "test", webhookIdSet: true },
        };
      }
      if (url.pathname === "/shop/settings/payment-providers") return providers;
      return undefined;
    });
    renderScreen(<PaymentsPage />, withShop);

    const choice = await screen.findByLabelText("United Kingdom · GBP");
    expect(
      within(choice).getByRole("option", { name: "PayPal (not connected yet)" }),
    ).toBeDisabled();

    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "PayPal" }));
    expect(screen.getByText("https://shop.example.com/shop/paypal/webhook")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Client ID"), "AaBbCcDdEeFfGgHhIiJj0123");
    await user.type(screen.getByLabelText("Secret"), "EeFfGgHhIiJjKkLlMmNn9876");
    await user.type(screen.getByLabelText("Webhook ID"), "8PT597110X687430LKGECATA");
    await user.click(screen.getByRole("button", { name: "Save and check" }));

    await vi.waitFor(() =>
      expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
        clientId: "AaBbCcDdEeFfGgHhIiJj0123",
        clientSecret: "EeFfGgHhIiJjKkLlMmNn9876",
        webhookId: "8PT597110X687430LKGECATA",
        environment: "sandbox",
      }),
    );
  });
});

const preview: ShopifyImport = {
  id: "i1",
  status: "ready",
  stage: "products",
  done: 0,
  total: 11,
  paused: false,
  currency: "GBP",
  files: { products: { rows: 4 }, customers: { rows: 3 }, orders: null },
  counts: {
    products: 4,
    variants: 6,
    images: 5,
    customers: 3,
    orders: 0,
    collectionsInFile: ["Summer Edit"],
    tags: [{ tag: "summer", products: 2 }],
  },
  mapping: [
    { file: "products", column: "Title", field: "title" },
    { file: "products", column: "Variant Price", field: "price" },
  ],
  notImported: [{ file: "products", column: "Google Shopping / Gender" }],
  samples: [
    {
      handle: "linen-shirt",
      title: "Linen Shirt",
      variants: 2,
      images: 3,
      price: "45.00",
      status: "active",
    },
  ],
  warnings: ["1 gift card isn't imported: Lintel doesn't sell gift cards yet."],
  options: {
    productStatus: "keep",
    importImages: true,
    collectionsFromColumn: true,
    tagCollections: [],
    importCustomers: true,
    importOrders: false,
    productPathPrefix: "/products/",
  },
  report: {
    products: { created: 0, skipped: 0, failed: 0 },
    collections: { created: 0, skipped: 0, failed: 0 },
    customers: { created: 0, skipped: 0, failed: 0 },
    orders: { created: 0, skipped: 0, failed: 0 },
    images: { downloaded: 0, skipped: 0 },
    problems: [],
    redirects: [],
  },
  dryRunReport: null,
  createdAt: "2026-11-01T10:00:00Z",
  completedAt: null,
};

describe("moving from Shopify", () => {
  it("shows where every column goes, saves the choices and runs a dry run", async () => {
    let current = preview;
    const { calls } = mockApi(({ url, method, body }) => {
      if (url.pathname === "/shop/markets") return { markets: [ukMarket] };
      if (url.pathname === "/shop/imports") return { imports: [current] };
      if (url.pathname === "/shop/imports/i1/options") {
        current = { ...current, options: body as ShopifyImport["options"] };
        return current;
      }
      if (url.pathname === "/shop/imports/i1/dry-run" && method === "POST") {
        current = {
          ...current,
          dryRunReport: {
            ...preview.report,
            products: { created: 3, skipped: 1, failed: 0 },
            problems: [
              { stage: "products", item: "gift-card", message: "Gift cards aren't imported." },
            ],
          },
        };
        return current;
      }
      if (url.pathname === "/shop/imports/i1") return current;
      return undefined;
    });
    renderScreen(<ShopifyImportPage />, withShop);

    expect(await screen.findByText("Where everything goes")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Variant Price" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Price" })).toBeInTheDocument();
    expect(screen.getByText(/Google Shopping \/ Gender/)).toBeInTheDocument();
    expect(screen.getByText(/gift card isn't imported/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: /summer/ }));
    await vi.waitFor(() =>
      expect(calls.find((call) => call.method === "PUT")?.body).toMatchObject({
        tagCollections: ["summer"],
      }),
    );

    await user.click(screen.getByRole("button", { name: "Try a dry run" }));
    expect(await screen.findByText("Would bring in")).toBeInTheDocument();
    expect(screen.getByText("Gift cards aren't imported.")).toBeInTheDocument();
  });
});
