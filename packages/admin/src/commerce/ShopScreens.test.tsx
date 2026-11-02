import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { OrderDetailPage } from "./OrderDetailPage.js";
import type { Order } from "./orders.api.js";
import { PaymentsPage } from "./PaymentsPage.js";
import { ProductsPage } from "./ProductsPage.js";
import type { PaymentSettings } from "./shopSettings.api.js";

afterEach(() => vi.restoreAllMocks());

const withShop = { enabledPlugins: ["commerce"] };

const notConnected: PaymentSettings = {
  connected: false,
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

    const sourdough = await screen.findByRole("link", { name: /Sourdough/ });
    expect(within(sourdough).getByText("Sold out")).toBeInTheDocument();
    expect(
      within(screen.getByRole("link", { name: /Rye/ })).getByText("On sale"),
    ).toBeInTheDocument();
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
});
