import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { ProviderWaysToPay } from "./paymentProviders.api.js";
import type { PaymentSettings } from "./shopSettings.api.js";
import { WaysToPay } from "./WaysToPay.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const withShop = { enabledPlugins: ["commerce"] };

const settings: PaymentSettings = {
  connected: true,
  mode: "live",
  secretKey: { hint: "sk_live_…4242", source: "admin" },
  publishableKey: { value: "pk_live_x", source: "admin" },
  webhookSecret: { source: "admin" },
  webhookUrl: "https://shop.example.com/shop/stripe/webhook",
  webhookEvents: [],
  checkoutMode: "hosted",
  siteIsLocal: false,
  checksForPayments: false,
};

const stripe: ProviderWaysToPay = {
  provider: "stripe",
  mode: "live",
  methods: [
    { id: "card", name: "Card", waiting: false },
    { id: "afterpay_clearpay", name: "Clearpay", waiting: true },
  ],
};

function show(providers: ProviderWaysToPay[], payments: PaymentSettings = settings) {
  mockApi(({ url }) => {
    if (url.pathname === "/shop/settings/ways-to-pay") return { providers };
    if (url.pathname === "/shop/settings/payments") return payments;
    return undefined;
  });
  renderScreen(<WaysToPay />, withShop);
}

describe("ways to pay", () => {
  it("shows what's on, what's waiting, and how to add more", async () => {
    show([stripe]);
    const section = await screen.findByRole("region", { name: "Stripe" });
    expect(within(section).getByText("Card")).toBeInTheDocument();
    expect(within(section).getByText("Clearpay: waiting for approval")).toBeInTheDocument();
    expect(
      within(section).getByText(
        "Want Klarna? Switch it on in Stripe and it'll appear at checkout.",
      ),
    ).toBeInTheDocument();
    expect(
      within(section).getByRole("link", { name: /payment methods in Stripe/ }),
    ).toHaveAttribute("href", "https://dashboard.stripe.com/settings/payment_methods");
    expect(
      screen.getByText(
        "What shoppers see depends on their country, your shop's currency and the provider's approval.",
      ),
    ).toBeInTheDocument();
  });

  it("opens Stripe's test settings for a shop on test keys, and says they're test settings", async () => {
    show([{ ...stripe, mode: "test" }]);
    const link = await screen.findByRole("link", { name: /payment methods in Stripe/ });
    expect(link).toHaveAttribute(
      "href",
      "https://dashboard.stripe.com/test/settings/payment_methods",
    );
    expect(
      screen.getByText("These are your test settings. Live ones can differ."),
    ).toBeInTheDocument();
  });

  it("doesn't suggest a method the shop already has", async () => {
    show([
      {
        provider: "mollie",
        mode: "live",
        methods: [
          { id: "klarna", name: "Klarna", waiting: false },
          { id: "ideal", name: "iDEAL", waiting: false },
        ],
      },
    ]);
    await screen.findByRole("region", { name: "Mollie" });
    expect(screen.queryByText(/^Want /)).not.toBeInTheDocument();
  });

  it("says plainly when a provider can't tell us, and never promises Pay Later", async () => {
    show([
      { ...stripe, methods: null },
      { provider: "paypal", mode: "live", methods: null },
    ]);
    expect(await screen.findByText(/Stripe didn't tell us what's switched on/)).toBeInTheDocument();
    expect(screen.getByText(/PayPal doesn't share what it offers/)).toBeInTheDocument();
    expect(screen.queryByText(/Pay Later/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Want /)).not.toBeInTheDocument();
  });

  it("shows nothing until a provider is connected", async () => {
    const { calls } = mockApi(({ url }) =>
      url.pathname === "/shop/settings/ways-to-pay" ? { providers: [] } : settings,
    );
    renderScreen(<WaysToPay />, withShop);
    await vi.waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await vi.waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.queryByText("Ways to pay")).not.toBeInTheDocument();
  });
});

describe("the last message from Stripe", () => {
  it("says how long ago it was", async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60_000).toISOString();
    show([stripe], { ...settings, lastWebhookAt: twoMinutesAgo });
    expect(await screen.findByText("Last message from Stripe: 2 minutes ago")).toBeInTheDocument();
  });

  it("says so plainly when nothing has arrived since the webhook was saved", async () => {
    show([stripe], { ...settings, lastWebhookAt: null });
    expect(
      await screen.findByText(/Nothing has arrived from Stripe since the webhook was saved/),
    ).toBeInTheDocument();
  });

  it("stays quiet for a shop with no webhook set up", async () => {
    show([stripe], { ...settings, webhookSecret: null, lastWebhookAt: null });
    await screen.findByRole("region", { name: "Stripe" });
    expect(screen.queryByText(/from Stripe/)).not.toBeInTheDocument();
  });

  it("stays quiet when the server doesn't send it", async () => {
    show([stripe]);
    await screen.findByRole("region", { name: "Stripe" });
    expect(screen.queryByText(/from Stripe/)).not.toBeInTheDocument();
  });
});
