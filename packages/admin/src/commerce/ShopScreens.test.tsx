import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { OrderDetailPage } from "./OrderDetailPage.js";
import type { Order } from "./orders.api.js";
import { PaymentsPage } from "./PaymentsPage.js";
import { ProductsPage } from "./ProductsPage.js";
import { ShopHomePage } from "./ShopHomePage.js";
import type { PaymentSettings } from "./shopSettings.api.js";

afterEach(() => vi.restoreAllMocks());

const withShop = { enabledPlugins: ["commerce"] };

const notConnected: PaymentSettings = {
  connected: false,
  siteIsLocal: false,
  checksForPayments: false,
  mode: null,
  secretKey: null,
  publishableKey: null,
  webhookSecret: null,
  webhookUrl: "https://shop.example.com/shop/stripe/webhook",
  webhookEvents: ["checkout.session.completed", "payment_intent.succeeded"],
  checkoutMode: "hosted",
};

const pounds = (amount: number) => ({ amount, currency: "GBP" });

const paidOrder: Order = {
  id: "o1",
  number: 1001,
  name: "#1001",
  email: "grace@example.com",
  customerName: "Grace Hopper",
  status: "paid",
  paymentStatus: "paid",
  fulfilmentStatus: "unfulfilled",
  cancelled: false,
  isTest: false,
  total: pounds(9400),
  itemCount: 2,
  createdAt: "2026-10-31T10:00:00Z",
  customerId: "c1",
  shippingAddress: {
    name: "Grace Hopper",
    company: "",
    line1: "1 Navy Yard",
    line2: "",
    city: "London",
    region: "",
    postalCode: "E1 1AA",
    country: "GB",
    phone: "",
  },
  shippingLine: { name: "Standard delivery", amount: pounds(400) },
  subtotal: pounds(9000),
  discount: pounds(0),
  shipping: pounds(400),
  tax: pounds(1567),
  refunded: pounds(0),
  taxesIncluded: true,
  cancelledAt: null,
  cancelReason: null,
  refundable: pounds(9400),
  lines: [
    {
      id: "l1",
      productId: "p1",
      variantId: "v1",
      productTitle: "Linen shirt",
      variantTitle: "M",
      sku: "SHIRT-M",
      imageId: null,
      quantity: 2,
      unitPrice: pounds(4500),
      subtotal: pounds(9000),
      discount: pounds(0),
      tax: pounds(1500),
      fulfilledQuantity: 0,
      refundedQuantity: 0,
      unfulfilledQuantity: 2,
    },
  ],
  refunds: [],
  fulfilments: [],
  timeline: [
    { id: "t1", kind: "paid", message: "Paid £94.00 by card", createdAt: "2026-10-31T10:00:00Z" },
  ],
  stripePaymentUrl: null,
};

describe("the Shop screens", () => {
  it("guides a new shop to its first product", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/shop/products") return { items: [], total: 0 };
      return [];
    });
    renderScreen(<ProductsPage />, withShop);

    expect(await screen.findByText("No products yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Products" })).toBeInTheDocument();
  });

  // The list said "On sale" beside "0 in stock", while the website said "Sold out".
  it("says a product on sale with none left is sold out, as shoppers see it", async () => {
    const product = {
      handle: "loaf",
      imageId: null,
      variantCount: 1,
      priceRange: { currency: "GBP", min: 450, max: 450 },
      updatedAt: "2026-11-01T10:00:00Z",
    };
    mockApi(({ url }) => {
      if (url.pathname === "/shop/products") {
        return {
          items: [
            { ...product, id: "p1", title: "Sourdough", status: "active", available: 0 },
            { ...product, id: "p2", title: "Rye", status: "active", available: null },
          ],
          total: 2,
        };
      }
      return [];
    });
    renderScreen(<ProductsPage />, withShop);

    const sourdough = await screen.findByRole("row", { name: /Sourdough/ });
    expect(within(sourdough).getByText("Sold out")).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Rye/ })).getByText("On sale"),
    ).toBeInTheDocument();
    // Price and stock in their own columns, and the name opens the product.
    expect(within(sourdough).getAllByText("£4.50").length).toBeGreaterThan(0);
    expect(within(sourdough).getByRole("link", { name: "Sourdough" })).toHaveAttribute(
      "href",
      "/commerce/products/p1",
    );
  });

  it("connects Stripe step by step, saving the keys typed in", async () => {
    const { calls } = mockApi(({ url, method, body }) => {
      if (url.pathname !== "/shop/settings/payments") return undefined;
      if (method === "PUT") {
        return {
          ...notConnected,
          connected: true,
          mode: "test",
          secretKey: { hint: "4242", source: "admin" },
          publishableKey: {
            value: (body as { publishableKey: string }).publishableKey,
            source: "admin",
          },
        };
      }
      return notConnected;
    });
    renderScreen(<PaymentsPage />, withShop);

    expect(await screen.findByText("Make a Stripe account")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByText("https://shop.example.com/shop/stripe/webhook")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Publishable key"), "pk_test_abc");
    await user.type(screen.getByLabelText("Secret key"), "sk_test_4242");
    await user.click(screen.getByRole("button", { name: "Save keys" }));

    expect(await screen.findByText("Test mode")).toBeInTheDocument();
    const saved = calls.find((call) => call.method === "PUT");
    expect(saved?.body).toEqual({ secretKey: "sk_test_4242", publishableKey: "pk_test_abc" });
  });

  it("refunds an amount, and won't refund more than was paid", async () => {
    const { calls } = mockApi(({ url, method }) => {
      if (url.pathname === "/shop/orders/o1/refunds" && method === "POST") {
        return { ...paidOrder, status: "partially_refunded", refunded: pounds(1000) };
      }
      return paidOrder;
    });
    renderScreen(<OrderDetailPage orderId="o1" />, withShop);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Order #1001" }),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Refund" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(dialog.getByRole("radio", { name: "An amount" }));

    const amount = dialog.getByLabelText("Amount (GBP)");
    await user.type(amount, "500");
    await user.click(dialog.getByRole("button", { name: "Refund" }));
    expect(
      await screen.findByText("Enter an amount more than 0 and no more than £94.00."),
    ).toBeInTheDocument();

    await user.clear(amount);
    await user.type(amount, "10");
    await user.click(dialog.getByRole("button", { name: "Refund" }));

    await vi.waitFor(() =>
      expect(calls.find((call) => call.method === "POST")?.body).toMatchObject({
        amount: 1000,
        lines: [],
      }),
    );
  });

  describe("the Shop home's setup card and warning (LINTEL-LEFT-002, LINTEL-UX-009)", () => {
    const market = { id: "m1", name: "United Kingdom", currency: "GBP" };
    const zoneWithPrice = { id: "z1", name: "UK", countries: ["GB"], rates: [{ id: "r1" }] };
    function shop({
      stripeConnected,
      provider = "stripe",
      productCount = 0,
    }: {
      stripeConnected: boolean;
      provider?: "stripe" | "paypal";
      productCount?: number;
    }) {
      mockApi(({ url }) => {
        switch (url.pathname) {
          case "/shop/markets":
            return { markets: [{ ...market, countries: ["GB"], isPrimary: true }] };
          case "/shop/shipping/zones":
            return { zones: [zoneWithPrice] };
          case "/shop/settings/payments":
            return { ...notConnected, connected: stripeConnected };
          case "/shop/settings/payment-providers":
            return {
              paypal: { connected: false },
              mollie: { connected: false },
              markets: [{ ...market, paymentProvider: provider }],
            };
          case "/shop/products":
            return { items: [], total: productCount };
          default:
            return [];
        }
      });
    }

    // A warning box, a checklist and a footer all said the same thing.
    it("puts setup in one card: what's left, how far along, and why it matters", async () => {
      shop({ stripeConnected: false });
      renderScreen(<ShopHomePage />, withShop);

      const card = await screen.findByRole("region", { name: "Get ready to sell" });
      expect(
        within(card).getByText(/shows your products as “Coming soon” until these are done/),
      ).toBeInTheDocument();
      expect(within(card).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
      expect(within(card).getByText("2 of 4 done")).toBeInTheDocument();
      expect(within(card).getByRole("link", { name: /Connect Stripe/ })).toHaveAttribute(
        "href",
        "/commerce/settings/payments",
      );
      expect(
        within(card).getByText("Done: Choose where you sell, Set your delivery prices"),
      ).toBeInTheDocument();
      expect(screen.queryByText(/isn’t connected/)).not.toBeInTheDocument();
    });

    it("shows neither once the shop is set up and can take orders", async () => {
      shop({ stripeConnected: true, productCount: 1 });
      renderScreen(<ShopHomePage />, withShop);
      expect(await screen.findByText("Products")).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Get ready to sell" })).not.toBeInTheDocument();
      expect(screen.queryByText(/Coming soon/)).not.toBeInTheDocument();
    });

    it("warns, after setup, when a market pays with a provider that isn't connected", async () => {
      shop({ stripeConnected: true, provider: "paypal", productCount: 1 });
      renderScreen(<ShopHomePage />, withShop);
      expect(
        await screen.findByText(/the way you take payment isn’t connected/),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Connect payments" })).toHaveAttribute(
        "href",
        "/commerce/settings/payments",
      );
    });
  });

  // Nothing on the website linked to the shop unless someone added the link by hand.
  describe("the offer to add Shop to the main menu (LINTEL-UX-009)", () => {
    const mainMenu = {
      id: "n1",
      handle: "main",
      name: "Main menu",
      maxDepth: 2,
      source: "items",
      itemCount: 1,
      updatedAt: "2026-11-01T10:00:00Z",
      items: [
        { id: "i1", label: "About", entryId: null, url: "/about", newTab: false, children: [] },
      ],
      pageTree: { includeHome: true, hiddenEntryIds: [], labels: {} },
      linkedEntries: {},
    };

    function emptyShop(path: string): unknown {
      if (path === "/shop/products") return { items: [], total: 0 };
      if (path === "/shop/markets") return { markets: [] };
      if (path === "/shop/shipping/zones") return { zones: [] };
      if (path === "/shop/settings/payments") return notConnected;
      if (path === "/shop/settings/payment-providers") {
        return { paypal: { connected: false }, mollie: { connected: false }, markets: [] };
      }
      return [];
    }

    it("adds a Shop link to the end of the main menu", async () => {
      const { calls } = mockApi(({ url, method }) => {
        if (url.pathname === "/navigation/main") {
          return method === "PUT" ? { ...mainMenu, itemCount: 2 } : mainMenu;
        }
        return emptyShop(url.pathname);
      });
      renderScreen(<ShopHomePage />, withShop);

      await userEvent.click(await screen.findByRole("button", { name: "Add to menu" }));

      expect(await screen.findByText("Shop is now in your main menu.")).toBeInTheDocument();
      const saved = calls.find((call) => call.method === "PUT");
      expect(saved?.body).toMatchObject({
        items: [
          { label: "About", url: "/about" },
          { label: "Shop", url: "/shop", entryId: null, newTab: false, children: [] },
        ],
      });
    });

    // A link to a deleted page made the save fail with "Some fields need attention: <an id>".
    it("says a link to a deleted page will go, and takes it out so the menu saves", async () => {
      const withDeletedPage = {
        ...mainMenu,
        items: [
          ...mainMenu.items,
          { id: "i2", label: "", entryId: "gone", url: null, newTab: false, children: [] },
        ],
      };
      const { calls } = mockApi(({ url, method }) => {
        if (url.pathname === "/navigation/main") {
          return method === "PUT" ? mainMenu : withDeletedPage;
        }
        return emptyShop(url.pathname);
      });
      renderScreen(<ShopHomePage />, withShop);

      expect(
        await screen.findByText(/One link in the menu goes to a page that was deleted/),
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Add to menu" }));

      expect(await screen.findByText("Shop is now in your main menu.")).toBeInTheDocument();
      const saved = calls.find((call) => call.method === "PUT")?.body as {
        items: Array<{ entryId: string | null }>;
      };
      expect(saved.items.map((item) => item.entryId)).toEqual([null, null]);
    });

    it("isn't offered once the menu links to the shop, or follows the page tree", async () => {
      for (const menu of [
        { ...mainMenu, items: [{ ...mainMenu.items[0], url: "/shop" }] },
        { ...mainMenu, source: "pageTree" },
      ]) {
        mockApi(({ url }) => {
          if (url.pathname === "/navigation/main") return menu;
          return emptyShop(url.pathname);
        });
        renderScreen(<ShopHomePage />, withShop);
        expect(await screen.findByText("Products")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Add to menu" })).not.toBeInTheDocument();
        cleanup();
      }
    });
  });
});
