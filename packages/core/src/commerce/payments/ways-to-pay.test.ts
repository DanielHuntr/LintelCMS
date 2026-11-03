import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../../testing/test-database.js";
import type { CheckoutRow } from "../checkouts/checkouts.table.js";
import { FAKE_MOLLIE_API_KEY, FakeMollie } from "../testing/fake-mollie.js";
import { FAKE_PAYPAL } from "../testing/fake-paypal.js";
import {
  CHECKOUT_PAGES,
  DELIVERY_ADDRESS,
  fillCart,
  startTestShop,
  stockTheShop,
  type TestShop,
} from "../testing/test-shop.js";
import { createMolliePayment } from "./mollie/mollie-api.js";
import { MollieClient } from "./mollie/mollie-client.js";

/**
 * What the shop tells owners about ways to pay, and what methods that redirect or confirm
 * late (Klarna, Clearpay, iDEAL, bank transfers) need from it. Stripe and Mollie are faked:
 * these check what Lintel sends and how it reacts, not what the real providers do with it.
 *
 * The test shop sells a £45 shirt with £4.95 delivery and 20% tax on top: £59.94.
 */
const SLOW_TEST = 60_000;

const on = { available: true, display_preference: { value: "on" } };
const off = { available: false, display_preference: { value: "off" } };
const waiting = { available: false, display_preference: { value: "on" } };

interface MollieLine {
  type?: string;
  totalAmount: { value: string };
}

describe("ways to pay", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop;
  beforeEach(async () => {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase);
  });
  afterEach(() => shop.server.close());

  async function readProvider(provider: string) {
    const answer = await shop.admin("GET", "/shop/settings/ways-to-pay");
    expect(answer.statusCode).toBe(200);
    const providers: Array<{ provider: string }> = answer.json().providers;
    return providers.find((candidate) => candidate.provider === provider);
  }

  async function useMollie() {
    const stocked = await stockTheShop(shop);
    await shop.admin("PUT", "/shop/settings/payment-providers/mollie", {
      apiKey: FAKE_MOLLIE_API_KEY,
    });
    await shop.admin("PATCH", `/shop/markets/${stocked.market.id}`, { paymentProvider: "mollie" });
    return stocked;
  }

  async function startPaying(token: string) {
    const started = await shop.storefront(
      "POST",
      `/delivery/shop/carts/${token}/checkout`,
      CHECKOUT_PAGES,
    );
    expect(started.statusCode).toBe(201);
    return started.json();
  }

  it(
    "reads Stripe's methods from the default configuration only",
    async () => {
      shop.stripe.paymentMethodConfigurations = [
        { id: "pmc_other", is_default: false, active: true, ideal: on },
        {
          id: "pmc_default",
          name: "Default",
          is_default: true,
          active: true,
          livemode: false,
          klarna: on,
          card: on,
          afterpay_clearpay: waiting,
          ideal: off,
          twint: on,
        },
      ];

      expect(await readProvider("stripe")).toEqual({
        provider: "stripe",
        mode: "test",
        methods: [
          { id: "card", name: "Card", waiting: false },
          { id: "klarna", name: "Klarna", waiting: false },
          { id: "afterpay_clearpay", name: "Clearpay", waiting: true },
          { id: "twint", name: "Twint", waiting: false },
        ],
      });
    },
    SLOW_TEST,
  );

  it(
    "says it doesn't know, rather than guessing, when a provider can't answer",
    async () => {
      shop.stripe.failNext = {
        path: "/v1/payment_method_configurations",
        status: 403,
        message: "This key can't read payment method configurations.",
      };
      expect(await readProvider("stripe")).toMatchObject({ methods: null });
      // No default configuration to read comes to the same thing.
      expect(await readProvider("stripe")).toMatchObject({ methods: null });

      await useMollie();
      shop.mollie.failMethods = true;
      expect(await readProvider("mollie")).toMatchObject({ methods: null });
    },
    SLOW_TEST,
  );

  it(
    "asks Mollie about the shop's own currency, and leaves out what it refused",
    async () => {
      await useMollie();
      shop.mollie.methods = [
        { id: "creditcard", description: "Card", status: "activated" },
        { id: "klarna", description: "Klarna", status: "pending-review" },
        { id: "in3", description: "iDEAL in3", status: "rejected" },
      ];
      shop.mollie.methodCurrencies.length = 0;

      expect(await readProvider("mollie")).toEqual({
        provider: "mollie",
        mode: "test",
        methods: [
          { id: "creditcard", name: "Card", waiting: false },
          { id: "klarna", name: "Klarna", waiting: true },
        ],
      });
      expect(shop.mollie.methodCurrencies).toEqual(["GBP"]);
    },
    SLOW_TEST,
  );

  it(
    "lists PayPal with nothing to show, and doesn't list a provider that isn't connected",
    async () => {
      expect(await readProvider("paypal")).toBeUndefined();
      expect(await readProvider("mollie")).toBeUndefined();
      await shop.admin("PUT", "/shop/settings/payment-providers/paypal", FAKE_PAYPAL);
      expect(await readProvider("paypal")).toEqual({
        provider: "paypal",
        mode: "test",
        methods: null,
      });
    },
    SLOW_TEST,
  );

  it(
    "gives Stripe the delivery address on hosted and embedded payments",
    async () => {
      const { variantId, rateId } = await stockTheShop(shop);
      const { token } = await fillCart(shop, variantId, rateId);
      await startPaying(token);
      const [session] = shop.stripe.requestsTo("/v1/checkout/sessions");
      const prefix = "payment_intent_data[shipping]";
      expect(session?.form.get("customer_email")).toBe("ada@example.com");
      expect(session?.form.get(`${prefix}[name]`)).toBe(DELIVERY_ADDRESS.name);
      expect(session?.form.get(`${prefix}[address][line1]`)).toBe(DELIVERY_ADDRESS.line1);
      expect(session?.form.get(`${prefix}[address][country]`)).toBe("GB");
      // An empty value would tell Stripe to clear the field.
      expect(session?.form.has(`${prefix}[address][line2]`)).toBe(false);

      await shop.admin("PUT", "/shop/settings/payments", { checkoutMode: "embedded" });
      await shop.storefront("POST", `/delivery/shop/carts/${token}/checkout`, {});
      const [intent] = shop.stripe.requestsTo("/v1/payment_intents");
      expect(intent?.form.get("receipt_email")).toBe("ada@example.com");
      expect(intent?.form.get("automatic_payment_methods[enabled]")).toBe("true");
      expect(intent?.form.get("shipping[name]")).toBe(DELIVERY_ADDRESS.name);
      expect(intent?.form.get("shipping[address][postal_code]")).toBe(DELIVERY_ADDRESS.postalCode);
      expect(intent?.form.get("shipping[address][country]")).toBe("GB");
    },
    SLOW_TEST,
  );

  it(
    "places a Stripe order only when a delayed payment really arrives",
    async () => {
      const { variantId, rateId } = await stockTheShop(shop);
      const { token } = await fillCart(shop, variantId, rateId);
      const checkout = await startPaying(token);
      const session = {
        id: "cs_test_delayed",
        amount_total: checkout.total.amount,
        currency: "gbp",
        payment_intent: "pi_test_delayed",
        client_reference_id: checkout.checkoutId,
      };

      await shop.sendWebhook({
        id: "evt_completed",
        type: "checkout.session.completed",
        data: { object: { ...session, payment_status: "unpaid" } },
      });
      expect((await shop.admin("GET", "/shop/orders")).json().total).toBe(0);

      await shop.sendWebhook({
        id: "evt_arrived",
        type: "checkout.session.async_payment_succeeded",
        data: { object: { ...session, payment_status: "paid" } },
      });
      expect((await shop.admin("GET", "/shop/orders")).json().total).toBe(1);
    },
    SLOW_TEST,
  );

  it(
    "sends Mollie the lines and addresses Klarna needs, adding up to the payment",
    async () => {
      const { variantId, rateId } = await useMollie();
      const { token } = await fillCart(shop, variantId, rateId);
      await startPaying(token);
      const [request] = shop.mollie.requestsTo("/v2/payments");
      const lines = request?.body?.lines as MollieLine[];
      expect(lines.map((line) => [line.type, line.totalAmount.value])).toEqual([
        [undefined, "45.00"],
        ["shipping_fee", "4.95"],
        ["surcharge", "9.99"],
      ]);
      expect(request?.body?.amount).toMatchObject({ value: "59.94" });
      const address = {
        givenName: "Ada",
        familyName: "Lovelace",
        email: "ada@example.com",
        streetAndNumber: DELIVERY_ADDRESS.line1,
        postalCode: DELIVERY_ADDRESS.postalCode,
        city: DELIVERY_ADDRESS.city,
        country: "GB",
      };
      expect(request?.body?.billingAddress).toEqual(address);
      expect(request?.body?.shippingAddress).toEqual(address);
    },
    SLOW_TEST,
  );

  it(
    "takes the money for a Mollie payment that stops at authorised, then places the order",
    async () => {
      const { variantId, rateId } = await useMollie();
      const { token } = await fillCart(shop, variantId, rateId);
      await startPaying(token);
      const [payment] = [...shop.mollie.payments.values()];
      if (!payment) throw new Error("The payment should have started");

      payment.status = "authorized";
      expect((await shop.sendMollieWebhook(payment.id)).statusCode).toBe(200);
      expect(shop.mollie.requestsTo(`/v2/payments/${payment.id}/captures`)).toHaveLength(1);
      expect((await shop.admin("GET", "/shop/orders")).json().total).toBe(0);

      await shop.sendMollieWebhook(payment.id);
      expect((await shop.admin("GET", "/shop/orders")).json().total).toBe(1);
    },
    SLOW_TEST,
  );

  it(
    "never takes the money for a Mollie authorisation that arrives after the checkout closed",
    async () => {
      const { variantId, rateId } = await useMollie();
      const { token } = await fillCart(shop, variantId, rateId);
      await startPaying(token);
      const [payment] = [...shop.mollie.payments.values()];
      if (!payment) throw new Error("The payment should have started");
      await startPaying(token);

      payment.status = "authorized";
      await shop.sendMollieWebhook(payment.id);
      expect(shop.mollie.requestsTo(`/v2/payments/${payment.id}/captures`)).toHaveLength(0);
    },
    SLOW_TEST,
  );

  it(
    "leaves a Mollie bank transfer open when its checkout closes, and honours it later",
    async () => {
      const { variantId, rateId } = await useMollie();
      const { token } = await fillCart(shop, variantId, rateId);
      await startPaying(token);
      const [transfer] = [...shop.mollie.payments.values()];
      if (!transfer) throw new Error("The payment should have started");
      transfer.method = "banktransfer";

      await startPaying(token);
      const deletes = () =>
        shop.mollie.requests.filter((request) => request.method === "DELETE").length;
      expect(deletes()).toBe(0);
      expect(transfer.status).toBe("open");

      transfer.status = "paid";
      await shop.sendMollieWebhook(transfer.id);
      expect((await shop.admin("GET", "/shop/orders")).json().total).toBe(1);

      // Any other unpaid payment is still closed.
      await startPaying(token);
      expect(deletes()).toBe(1);
    },
    SLOW_TEST,
  );
});

describe("Mollie's lines and addresses", () => {
  const checkout = {
    id: "9f0c3f5e-4f0a-4b7e-9a51-3f2d1a7c0a11",
    email: "cher@example.com",
    currency: "EUR",
    totalAmount: 4000,
    subtotalAmount: 5000,
    discountAmount: 1000,
    shippingAmount: 0,
    taxAmount: 800,
    taxesIncluded: true,
    discounts: [{ code: "SPRING", title: "Spring sale", amount: 1000 }],
    shippingLine: { rateId: "r1", name: "Free delivery", amount: 0, taxAmount: 0 },
    shippingAddress: {
      name: "Cher",
      company: "",
      line1: "Dam 1",
      line2: "",
      city: "Dublin",
      region: "",
      postalCode: "",
      country: "IE",
      phone: "",
    },
    lines: [
      {
        productTitle: "Mug",
        variantTitle: "",
        sku: null,
        quantity: 2,
        unitAmount: 2500,
        subtotalAmount: 5000,
      },
    ],
  } as unknown as CheckoutRow;

  it("takes discounts off as a line, and copes with one name and no postcode", async () => {
    const mollie = new FakeMollie();
    await createMolliePayment(
      new MollieClient({ apiKey: FAKE_MOLLIE_API_KEY, fetch: mollie.fetch }),
      checkout,
      CHECKOUT_PAGES,
      { webhookUrl: null, description: "Order" },
    );
    const [request] = mollie.requestsTo("/v2/payments");
    const lines = request?.body?.lines as MollieLine[];
    expect(lines.map((line) => [line.type, line.totalAmount.value])).toEqual([
      [undefined, "50.00"],
      ["discount", "-10.00"],
    ]);
    const total = lines.reduce((sum, line) => sum + Number(line.totalAmount.value), 0);
    expect(total).toBe(40);
    // An incomplete postal address would be refused, so the email stands in for it.
    expect(request?.body?.billingAddress).toEqual({
      givenName: "Cher",
      familyName: "Cher",
      email: "cher@example.com",
    });
  });
});
