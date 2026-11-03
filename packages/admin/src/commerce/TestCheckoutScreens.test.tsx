import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { OrdersPage } from "./OrdersPage.js";
import type { OrderSummary } from "./orders.api.js";
import type { PaymentProviders } from "./paymentProviders.api.js";
import { PaymentsPage } from "./PaymentsPage.js";
import type { PaymentSettings } from "./shopSettings.api.js";

afterEach(() => vi.restoreAllMocks());

const withShop = { enabledPlugins: ["commerce"] };

const stripeOnThisComputer: PaymentSettings = {
  connected: true,
  siteIsLocal: true,
  checksForPayments: true,
  mode: "test",
  secretKey: { hint: "sk_test_…4242", source: "admin" },
  publishableKey: { value: "pk_test_abc", source: "admin" },
  webhookSecret: null,
  webhookUrl: "http://localhost:4100/shop/stripe/webhook",
  webhookEvents: ["checkout.session.completed"],
  checkoutMode: "hosted",
};

const providers: PaymentProviders = {
  paypal: {
    connected: false,
    checksForPayments: false,
    mode: null,
    source: null,
    clientIdHint: null,
    webhookIdSet: false,
    webhookUrl: "http://localhost:4100/shop/paypal/webhook",
    webhookEvents: [],
  },
  mollie: {
    connected: false,
    checksForPayments: false,
    mode: null,
    source: null,
    apiKeyHint: null,
    webhookUrl: null,
  },
  markets: [{ id: "m1", name: "United Kingdom", currency: "GBP", paymentProvider: "stripe" }],
};

function paymentsApi(settings: PaymentSettings) {
  return mockApi(({ url }) => {
    if (url.pathname === "/shop/settings/payments") return settings;
    if (url.pathname === "/shop/settings/payment-providers") return providers;
    if (url.pathname === "/shop/markets") return { markets: [] };
    if (url.pathname === "/shop/shipping/zones") return { zones: [] };
    if (url.pathname === "/shop/products") return { items: [], total: 0 };
    return undefined;
  });
}

describe("the Payments page", () => {
  it("drops the webhook step on someone's own computer and says why", async () => {
    paymentsApi(stripeOnThisComputer);
    renderScreen(<PaymentsPage />, withShop);

    expect(
      await screen.findByText(
        "Lintel checks with Stripe for payments every few seconds while this site is on your computer. Nothing to set up.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Stripe is using test keys, so no real money moves.")).toBeVisible();
    expect(screen.getByText(/Stripe can't reach this computer/)).toBeInTheDocument();
    expect(screen.queryByText("Tell Stripe about payments")).not.toBeInTheDocument();
    expect(screen.queryByText(/Stripe CLI/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when a live site is still on test keys, and keeps the webhook step", async () => {
    paymentsApi({
      ...stripeOnThisComputer,
      siteIsLocal: false,
      checksForPayments: false,
      webhookSecret: { source: "admin" },
    });
    renderScreen(<PaymentsPage />, withShop);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This site is live, but Stripe is still using test keys",
    );
    expect(screen.getByText("Tell Stripe about payments")).toBeInTheDocument();
  });
});

const testOrder: OrderSummary = {
  id: "o1",
  number: 1001,
  name: "#1001",
  email: "tester@example.com",
  customerName: "Test Shopper",
  status: "paid",
  paymentStatus: "paid",
  fulfilmentStatus: "unfulfilled",
  cancelled: false,
  isTest: true,
  total: { amount: 4995, currency: "GBP" },
  itemCount: 1,
  createdAt: "2026-11-03T10:00:00.000Z",
};

describe("test orders", () => {
  it("are badged, and can be deleted after asking", async () => {
    let count = 1;
    const { calls } = mockApi(({ url, method }) => {
      if (url.pathname === "/shop/test-orders" && method === "DELETE") {
        count = 0;
        return { deleted: 1 };
      }
      if (url.pathname === "/shop/test-orders") return { count };
      if (url.pathname === "/shop/orders") {
        return count > 0 ? { items: [testOrder], total: 1 } : { items: [], total: 0 };
      }
      return { items: [], total: 0 };
    });
    renderScreen(<OrdersPage />, withShop);

    expect(await screen.findByText("Test")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Delete test orders" }));
    expect(await screen.findByText(/puts the stock back/)).toBeInTheDocument();
    const buttons = await screen.findAllByRole("button", {
      name: "Delete test orders",
      hidden: true,
    });
    await userEvent.click(buttons.at(-1) as HTMLElement);

    expect(await screen.findByText("No orders yet")).toBeInTheDocument();
    expect(
      calls.some((call) => call.method === "DELETE" && call.url.pathname === "/shop/test-orders"),
    ).toBe(true);
  });
});
