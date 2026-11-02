/**
 * The storefront API as the shop's elements use it, through the website's own address
 * (`/_lintel/api/shop/...`), so no other origin is involved. The cart's token is kept in
 * the browser; anyone holding it can see the cart, like a session.
 */

export interface Money {
  amount: number;
  currency: string;
}

export interface CartLine {
  id: string;
  productTitle: string;
  productHandle: string | null;
  variantTitle: string;
  image: { url: string; alt: string } | null;
  quantity: number;
  unitPrice: Money | null;
  subtotal: Money;
  problem: string | null;
  quantityAvailable: number | null;
}

export interface Cart {
  email: string | null;
  country: string | null;
  shippingAddress: Record<string, string> | null;
  shippingRateId: string | null;
  lines: CartLine[];
  itemCount: number;
  subtotal: Money;
  shipping: Money | null;
  total: Money;
  readyForCheckout: boolean;
}

export class ShopRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ShopRequestError";
  }
}

const tokenKey = "lintel-cart";
const checkoutKey = "lintel-checkout";

export function apiBase(): string {
  return document.querySelector<HTMLElement>("[data-api]")?.dataset.api ?? "/_lintel/api";
}

export async function shopRequest<Answer>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Answer> {
  const response = await fetch(`${apiBase()}/shop${path}`, {
    method: init.method ?? "GET",
    headers:
      init.body === undefined
        ? { accept: "application/json" }
        : { accept: "application/json", "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const answer = (await response.json().catch(() => ({}))) as Answer & { message?: string };
  if (!response.ok) {
    throw new ShopRequestError(
      answer.message ?? "The shop couldn’t do that just now. Please try again.",
      response.status,
    );
  }
  return answer;
}

export function savedCartToken(): string | null {
  try {
    return window.localStorage.getItem(tokenKey);
  } catch {
    return null;
  }
}

function saveCartToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(tokenKey, token);
    else window.localStorage.removeItem(tokenKey);
  } catch {
    // Private browsing can refuse storage; the cart then lasts as long as the page.
  }
}

export function forgetCart(): void {
  saveCartToken(null);
}

export async function loadCart(): Promise<Cart | null> {
  const token = savedCartToken();
  if (!token) return null;
  try {
    return await shopRequest<Cart>(`/carts/${encodeURIComponent(token)}`);
  } catch (error) {
    if (error instanceof ShopRequestError && error.status === 404) saveCartToken(null);
    return null;
  }
}

async function cartToken(): Promise<string> {
  const saved = savedCartToken();
  if (saved) return saved;
  const created = await shopRequest<{ token: string }>("/carts", { method: "POST", body: {} });
  saveCartToken(created.token);
  return created.token;
}

export async function addToCart(variantId: string, quantity: number): Promise<Cart> {
  const token = await cartToken();
  try {
    return await shopRequest<Cart>(`/carts/${encodeURIComponent(token)}/lines`, {
      method: "POST",
      body: { variantId, quantity },
    });
  } catch (error) {
    // An expired cart: start a new one and try once more.
    if (!(error instanceof ShopRequestError) || error.status !== 404) throw error;
    saveCartToken(null);
    const fresh = await cartToken();
    return shopRequest<Cart>(`/carts/${encodeURIComponent(fresh)}/lines`, {
      method: "POST",
      body: { variantId, quantity },
    });
  }
}

export async function changeLine(lineId: string, quantity: number): Promise<Cart> {
  const token = await cartToken();
  return shopRequest<Cart>(
    `/carts/${encodeURIComponent(token)}/lines/${encodeURIComponent(lineId)}`,
    { method: "PATCH", body: { quantity } },
  );
}

export async function updateCart(changes: Record<string, unknown>): Promise<Cart> {
  const token = await cartToken();
  return shopRequest<Cart>(`/carts/${encodeURIComponent(token)}`, {
    method: "PATCH",
    body: changes,
  });
}

/**
 * One way to deliver the cart, exactly as `GET /delivery/shop/carts/:token/shipping-rates`
 * answers (`ShippingQuote` in core). A contract test in core feeds the real answer through
 * `describeShippingRate`, so the two can't drift apart again.
 */
export interface ShippingRate {
  rateId: string;
  name: string;
  deliveryEstimate: string;
  amount: Money;
}

/** How a delivery choice reads to the shopper: "Standard, £4.95 (2 to 3 working days)". */
export function describeShippingRate(rate: ShippingRate): string {
  const price = `${rate.name}, ${formatMoney(rate.amount)}`;
  return rate.deliveryEstimate ? `${price} (${rate.deliveryEstimate})` : price;
}

/**
 * What to tell the shopper when something fails. The shop's own answers are written for
 * shoppers; anything else (a bug, a dropped connection) gets a plain sentence instead of
 * the browser's technical message.
 */
export function shopperMessage(error: unknown, fallback: string): string {
  return error instanceof ShopRequestError ? error.message : fallback;
}

export async function listShippingRates(): Promise<ShippingRate[]> {
  const token = await cartToken();
  const answer = await shopRequest<{ rates?: ShippingRate[]; items?: ShippingRate[] }>(
    `/carts/${encodeURIComponent(token)}/shipping-rates`,
  );
  return answer.rates ?? answer.items ?? [];
}

/** Starts paying: the shop's payment provider takes over from the address it answers with. */
export async function startCheckout(): Promise<{
  checkoutId: string;
  url: string | null;
  mode: string;
}> {
  const token = await cartToken();
  const origin = window.location.origin;
  const checkout = await shopRequest<{ checkoutId: string; url: string | null; mode: string }>(
    `/carts/${encodeURIComponent(token)}/checkout`,
    {
      method: "POST",
      body: { successUrl: `${origin}/order-confirmation`, cancelUrl: `${origin}/cart` },
    },
  );
  try {
    window.sessionStorage.setItem(checkoutKey, checkout.checkoutId);
  } catch {
    // Without storage the confirmation page reads the id from its address instead.
  }
  return checkout;
}

export function startedCheckoutId(): string | null {
  const fromAddress = new URLSearchParams(window.location.search).get("checkout");
  if (fromAddress) return fromAddress;
  try {
    return window.sessionStorage.getItem(checkoutKey);
  } catch {
    return null;
  }
}

export function formatMoney(money: Money): string {
  try {
    const format = new Intl.NumberFormat(document.documentElement.lang || undefined, {
      style: "currency",
      currency: money.currency,
    });
    const places = format.resolvedOptions().maximumFractionDigits ?? 2;
    return format.format(money.amount / 10 ** places);
  } catch {
    return `${(money.amount / 100).toFixed(2)} ${money.currency}`;
  }
}
