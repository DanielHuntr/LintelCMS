import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUpCheckoutDetails } from "./cart-views.js";
import type { Cart } from "./shop-api.js";

/*
 * The basket page as a shopper uses it, with the storefront API answered from here. The
 * answers' shapes are the API's own; storefront-site-contract.test.ts in core checks them
 * against the real API.
 */

const pounds = (amount: number) => ({ amount, currency: "GBP" });

function cartWith(changes: Partial<Cart> = {}): Cart {
  return {
    email: null,
    country: "GB",
    shippingAddress: null,
    shippingRateId: null,
    lines: [],
    itemCount: 2,
    subtotal: pounds(9000),
    shipping: null,
    total: pounds(9000),
    readyForCheckout: false,
    ...changes,
  };
}

type Answer = { status?: number; body: unknown } | Error;

function answerRequests(answers: Record<string, Answer>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const key = Object.keys(answers).find((path) =>
      `${init?.method ?? "GET"} ${url}`.endsWith(path),
    );
    const answer = key ? answers[key] : { status: 404, body: { message: "Not found" } };
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer?.body ?? {}), { status: answer?.status ?? 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function fillDetails(form: HTMLFormElement) {
  const values: Record<string, string> = {
    email: "ada@example.com",
    name: "Ada Lovelace",
    line1: "12 St James's Square",
    city: "London",
    postalCode: "SW1Y 4JH",
  };
  for (const [name, value] of Object.entries(values)) {
    const input = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
    if (input) input.value = value;
  }
}

async function chooseDelivery() {
  const form = document.querySelector<HTMLFormElement>(".lintel-cart__checkout-form");
  if (!form) throw new Error("The details form is missing");
  fillDetails(form);
  form.dispatchEvent(new Event("submit", { cancelable: true }));
  await vi.waitFor(() => {
    expect(form.querySelector("button[type=submit]")?.hasAttribute("disabled")).toBe(false);
  });
  return form;
}

describe("the basket page's delivery details", () => {
  beforeEach(() => {
    window.localStorage.setItem("lintel-cart", "token-1");
    document.body.innerHTML =
      '<div class="lintel-cart lintel-cart--page" data-behaviour="cart" data-cart-view="page" data-api="/api"></div>';
    setUpCheckoutDetails(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.body.innerHTML = "";
  });

  it("lists the delivery rates the API offers, then offers to pay", async () => {
    answerRequests({
      "PATCH /api/shop/carts/token-1": { body: cartWith() },
      "GET /api/shop/carts/token-1/shipping-rates": {
        body: {
          rates: [
            {
              rateId: "rate-standard",
              name: "Standard",
              deliveryEstimate: "2 to 3 working days",
              amount: pounds(495),
            },
          ],
        },
      },
    });

    const form = await chooseDelivery();

    const choice = form.querySelector<HTMLInputElement>("input[name=shippingRateId]");
    expect(choice?.value).toBe("rate-standard");
    expect(choice?.checked).toBe(true);
    expect(choice?.parentElement?.textContent).toBe("Standard, £4.95 (2 to 3 working days)");
    expect(form.querySelector("button[type=submit]")?.textContent).toBe("Pay now");
    expect(form.querySelector(".lintel-cart__message")?.textContent).toBe("");
  });

  it("shows the shop's own message when the API refuses", async () => {
    answerRequests({
      "PATCH /api/shop/carts/token-1": {
        status: 400,
        body: { message: "Please check the postcode." },
      },
    });

    const form = await chooseDelivery();

    expect(form.querySelector(".lintel-cart__message")?.textContent).toBe(
      "Please check the postcode.",
    );
  });

  it("never shows a technical error to the shopper", async () => {
    answerRequests({
      "PATCH /api/shop/carts/token-1": { body: cartWith() },
      "GET /api/shop/carts/token-1/shipping-rates": new TypeError(
        "Cannot read properties of undefined (reading 'amount')",
      ),
    });

    const form = await chooseDelivery();

    const message = form.querySelector(".lintel-cart__message")?.textContent ?? "";
    expect(message).toBe("Something went wrong. Please try again.");
    expect(message).not.toMatch(/undefined|properties/);
  });
});
