import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderCartViews, setUpCheckoutDetails, setUpDiscountCode } from "./cart-views.js";
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
    discountCodes: [],
    lines: [],
    itemCount: 2,
    subtotal: pounds(9000),
    discounts: [],
    discountProblems: [],
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
    // Said aloud by screen readers (LINTEL-A11Y-002); focus is checked in a real browser, in
    // browser-tests/shop-cart-focus.test.ts.
    expect(form.querySelector(".lintel-cart__message")?.textContent).toBe(
      "1 way to deliver. Check it, then choose Pay now.",
    );
  });

  it("counts the ticked delivery in the total before Pay now (LINTEL-FUNC-035)", async () => {
    const fetchMock = answerRequests({
      "PATCH /api/shop/carts/token-1": { body: cartWith() },
      "GET /api/shop/carts/token-1/shipping-rates": {
        body: {
          rates: [
            { rateId: "rate-standard", name: "Standard", amount: pounds(495) },
            { rateId: "rate-fast", name: "Next day", amount: pounds(895) },
          ],
        },
      },
    });
    const sentRates = () =>
      fetchMock.mock.calls
        .map(([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")))
        .flatMap((body: { shippingRateId?: string }) => body.shippingRateId ?? []);

    const form = await chooseDelivery();
    await vi.waitFor(() => expect(sentRates()).toEqual(["rate-standard"]));

    const fast = form.querySelector<HTMLInputElement>('input[value="rate-fast"]');
    if (!fast) throw new Error("The second rate is missing");
    fast.checked = true;
    fast.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(sentRates()).toEqual(["rate-standard", "rate-fast"]));
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

const shirt = {
  id: "line-1",
  productTitle: "Linen shirt",
  productHandle: "linen-shirt",
  variantTitle: "M",
  image: null,
  quantity: 2,
  unitPrice: pounds(4500),
  subtotal: pounds(9000),
  problem: null,
  quantityAvailable: 5,
};

const withSave10 = cartWith({
  lines: [shirt],
  discountCodes: ["SAVE10"],
  discounts: [{ code: "SAVE10", title: "Ten off", amount: pounds(900), freeShipping: false }],
  shipping: pounds(495),
  total: pounds(8595),
});

function totalsShown(): string[] {
  return [...document.querySelectorAll(".lintel-cart--page .lintel-cart__totals dt")].map(
    (term) => `${term.textContent} ${term.nextElementSibling?.textContent}`,
  );
}

describe("discounts in the basket", () => {
  const showCart = (cart: Cart) => renderCartViews(cart, showCart);

  beforeEach(() => {
    window.localStorage.setItem("lintel-cart", "token-1");
    document.body.innerHTML =
      '<div class="lintel-cart lintel-cart--page" data-behaviour="cart" data-cart-view="page" data-api="/api"></div>';
    setUpDiscountCode(showCart);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.body.innerHTML = "";
  });

  it("shows each discount as its own line, so the sums add up", () => {
    showCart(withSave10);

    expect(totalsShown()).toEqual([
      "Subtotal £90.00",
      "Discount (SAVE10) −£9.00",
      "Delivery £4.95",
      "Total £85.95",
    ]);
  });

  it("shows free delivery at its full price with the saving below it", () => {
    showCart(
      cartWith({
        lines: [shirt],
        discountCodes: ["FREESHIP"],
        discounts: [
          { code: "FREESHIP", title: "Free delivery", amount: pounds(495), freeShipping: true },
        ],
        shipping: pounds(0),
        total: pounds(9000),
      }),
    );

    expect(totalsShown()).toEqual([
      "Subtotal £90.00",
      "Delivery £4.95",
      "Free delivery (FREESHIP) −£4.95",
      "Total £90.00",
    ]);
  });

  it("applies a typed code and lists it with a Remove button", async () => {
    showCart(cartWith({ lines: [shirt] }));
    const fetchMock = answerRequests({ "PATCH /api/shop/carts/token-1": { body: withSave10 } });

    const box = document.querySelector<HTMLFormElement>(".lintel-cart__discount");
    expect(box?.hidden).toBe(false);
    const input = box?.querySelector<HTMLInputElement>("input[name=discountCode]");
    if (!box || !input) throw new Error("The discount code box is missing");
    input.value = " save10 ";
    box.dispatchEvent(new Event("submit", { cancelable: true }));

    await vi.waitFor(() => expect(totalsShown()).toContain("Discount (SAVE10) −£9.00"));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      discountCodes: ["save10"],
    });
    expect(input.value).toBe("");
    expect(document.querySelector("[aria-label='Remove the code SAVE10']")?.textContent).toBe(
      "Remove",
    );
  });

  it("says why a code was refused, by the box", async () => {
    showCart(cartWith({ lines: [shirt] }));
    answerRequests({
      "PATCH /api/shop/carts/token-1": {
        status: 400,
        body: { message: "This code isn't valid. Check it's typed correctly." },
      },
    });

    const box = document.querySelector<HTMLFormElement>(".lintel-cart__discount");
    const input = box?.querySelector<HTMLInputElement>("input[name=discountCode]");
    if (!box || !input) throw new Error("The discount code box is missing");
    input.value = "NOPE";
    box.dispatchEvent(new Event("submit", { cancelable: true }));

    await vi.waitFor(() =>
      expect(box.querySelector(".lintel-cart__discount-problems")?.textContent).toBe(
        "This code isn't valid. Check it's typed correctly.",
      ),
    );
  });
});

describe("the basket page's country", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("offers only the countries the shop delivers to, by name", async () => {
    answerRequests({
      "GET /api/shop/markets": {
        body: {
          markets: [
            { handle: "uk", countries: ["GB"], deliveryCountries: ["GB"] },
            { handle: "europe", countries: ["IE", "FR", "DE"], deliveryCountries: ["IE", "FR"] },
          ],
        },
      },
    });
    document.body.innerHTML =
      '<div class="lintel-cart lintel-cart--page" data-behaviour="cart" data-cart-view="page" data-api="/api"></div>';
    setUpCheckoutDetails(() => {});

    const picker = document.querySelector<HTMLSelectElement>("select[name=country]");
    expect(picker?.labels?.[0]?.firstChild?.textContent).toBe("Country");
    await vi.waitFor(() => expect(picker?.options.length).toBe(3));
    expect([...(picker?.options ?? [])].map((option) => `${option.value} ${option.text}`)).toEqual([
      "FR France",
      "IE Ireland",
      "GB United Kingdom",
    ]);
    expect(picker?.value).toBe("GB");
    expect(document.querySelector("input[name=country]")).toBeNull();
  });
});

describe("basket lines without a picture", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("show the neutral no-picture tile instead of a broken image", () => {
    document.body.innerHTML = `
      <div class="lintel-cart lintel-cart--page" data-behaviour="cart" data-cart-view="page">
        <template class="lintel-cart__no-picture"><svg class="lucide-shopping-bag"></svg></template>
      </div>`;
    const withPicture = {
      ...shirt,
      id: "line-2",
      productTitle: "Linen trousers",
      image: { url: "/media/trousers.jpg", alt: "" },
    };

    renderCartViews(cartWith({ lines: [shirt, withPicture] }), () => {});

    const [first, second] = document.querySelectorAll(".lintel-cart__line");
    expect(first?.querySelector("img")).toBeNull();
    const tile = first?.querySelector(".lintel-cart__line-picture");
    expect(tile?.getAttribute("aria-hidden")).toBe("true");
    expect(tile?.querySelector("svg.lucide-shopping-bag")).not.toBeNull();
    expect(second?.querySelector("img")?.getAttribute("src")).toBe("/media/trousers.jpg");
  });
});
