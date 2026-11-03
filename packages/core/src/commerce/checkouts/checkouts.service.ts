import { randomUUID } from "node:crypto";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { readSetting } from "../../settings/settings.service.js";
import { findCartByToken, loadPricedCart, type PricedCart } from "../carts/cart-loading.js";
import { CartNotReadyError } from "../carts/carts.errors.js";
import type { ShopContext } from "../commerce.context.js";
import {
  PaymentProviderError,
  ShopNotReadyError,
  ShopRecordNotFoundError,
} from "../commerce.errors.js";
import { OutOfStockError } from "../inventory/inventory.errors.js";
import { reserveStock } from "../inventory/inventory.service.js";
import { findOrderRow } from "../orders/orders.repository.js";
import { holdDiscountUses } from "../discounts/discount-uses.js";
import { DiscountCodeError } from "../discounts/discounts.errors.js";
import {
  marketPaymentProvider,
  PAYMENT_PROVIDER_NAMES,
  type PaymentProviderId,
  ProviderRequestError,
  type StartedPayment,
} from "../payments/payment-provider.js";
import { confirmOpenCheckout } from "../payments/payment-confirmation.service.js";
import { paymentProviderFor } from "../payments/payment-providers.js";
import { StripeRequestError } from "../payments/stripe-client.js";
import { chooseTaxProvider } from "../taxes/taxes.service.js";
import type { TaxResult } from "../taxes/tax-provider.js";
import { checkoutTotals } from "./checkout-totals.js";
import { describeLine } from "./line-names.js";
import { abandonCheckout, closeProviderPayment } from "./checkout-expiry.js";
import {
  findCheckoutRow,
  insertCheckout,
  listOpenCheckoutRowsForCart,
  updateCheckoutRow,
} from "./checkouts.repository.js";
import type {
  CheckoutStatusResponse,
  StartCheckoutRequest,
  StartedCheckout,
} from "./checkouts.schema.js";
import type { CheckoutRow } from "./checkouts.table.js";

/**
 * Going from a cart to paying: freeze the prices, work out tax, hold the stock and any
 * discount's use, and ask the market's payment provider (Stripe, PayPal or Mollie) for a
 * payment. The order itself is made later, once the provider confirms the payment
 * (orders/order-placement).
 */

/** How long stock is held, and the payment page stays open. Stripe needs at least 30 minutes. */
export const CHECKOUT_WINDOW_MINUTES = 35;

export async function startCheckout(
  shop: ShopContext,
  token: string,
  request: StartCheckoutRequest,
  { testSession = false }: { testSession?: boolean } = {},
): Promise<StartedCheckout> {
  const cartRow = await findCartByToken(shop.database, token);
  const cart = await loadPricedCart(shop, shop.database, cartRow);
  refuseUnreadyCart(cart);
  const { email, shippingAddress } = cartRow;
  if (!email || !shippingAddress) {
    throw new Error("refuseUnreadyCart checks the email and address");
  }
  refuseUnusableDiscounts(cart);
  // A checkout is only ever a test one because the request carried a good test session.
  const providerId: PaymentProviderId = testSession ? "test" : marketPaymentProvider(cart.market);
  const provider = paymentProviderFor(shop, providerId);
  const hosted = await provider.needsPages();
  if (hosted) {
    await refuseUnknownPages(shop, request);
  }
  // Fails now, with "connect it first", rather than after stock is held.
  await provider.checkReady();

  const checkoutId = randomUUID();
  const tax = await calculateTax(shop, cart, checkoutId);
  const totals = checkoutTotals(cart, tax);
  const now = shop.now();
  const expiresAt = new Date(now.getTime() + CHECKOUT_WINDOW_MINUTES * 60_000);

  // The new checkout replaces any the shopper started before; their stock goes back first.
  const replaced = await shop.database.transaction(async (transaction) => {
    const previous = await listOpenCheckoutRowsForCart(transaction, cartRow.id);
    for (const old of previous) {
      await abandonCheckout(transaction, old.id);
    }
    await insertCheckout(transaction, {
      id: checkoutId,
      tenantId: DEFAULT_TENANT_ID,
      cartId: cartRow.id,
      marketId: cart.market.id,
      email,
      shippingAddress,
      currency: cart.market.currency,
      discounts: cart.discounts.map(({ code, title, amount, discountId, freeShipping }) => ({
        code,
        title,
        amount,
        ...(discountId && { discountId }),
        ...(freeShipping && { freeShipping }),
      })),
      paymentProvider: providerId,
      taxCalculation: tax.calculation,
      taxReference: tax.reference,
      expiresAt,
      ...totals,
    });
    await reserveStock(
      transaction,
      checkoutId,
      totals.lines.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
        title: describeLine(line.productTitle, line.variantTitle),
      })),
      expiresAt,
      now,
    );
    await holdDiscountUses(transaction, checkoutId, cart.discounts, email, now);
    return previous;
  });
  await closeReplacedPayments(shop, replaced);

  const checkout = await findCheckoutRow(shop.database, DEFAULT_TENANT_ID, checkoutId);
  if (!checkout) throw new Error("The checkout just saved couldn't be read");
  let payment: StartedPayment;
  try {
    payment = await provider.startPayment(
      checkout,
      hosted ? { successUrl: request.successUrl ?? "", cancelUrl: request.cancelUrl ?? "" } : null,
    );
  } catch (error) {
    await abandonCheckout(shop.database, checkoutId);
    throw explainProviderError(error, providerId, "start the payment");
  }
  await updateCheckoutRow(shop.database, checkoutId, payment.saved);

  const currency = checkout.currency;
  const amount = (value: number) => ({ amount: value, currency });
  const publishableKey = providerId === "stripe" ? (await shop.stripeKeys()).publishableKey : null;
  return {
    checkoutId,
    provider: providerId,
    mode: hosted ? "hosted" : "embedded",
    url: payment.url,
    clientSecret: payment.clientSecret,
    publishableKey: publishableKey?.value ?? null,
    expiresAt: expiresAt.toISOString(),
    subtotal: amount(totals.subtotalAmount),
    discount: amount(totals.discountAmount),
    shipping: amount(totals.shippingAmount),
    tax: amount(totals.taxAmount),
    total: amount(totals.totalAmount),
    taxesIncluded: totals.taxesIncluded,
  };
}

export async function findCheckoutStatus(
  shop: ShopContext,
  checkoutId: string,
): Promise<CheckoutStatusResponse> {
  const found = await findCheckoutRow(shop.database, DEFAULT_TENANT_ID, checkoutId);
  if (!found) {
    throw new ShopRecordNotFoundError("checkout");
  }
  // The shopper is back, or waiting: ask the provider rather than wait for its webhook.
  await confirmOpenCheckout(shop, found);
  const checkout = (await findCheckoutRow(shop.database, DEFAULT_TENANT_ID, checkoutId)) ?? found;
  const order = checkout.orderId ? await findOrderRow(shop.database, checkout.orderId) : undefined;
  return {
    checkoutId: checkout.id,
    status: checkout.status,
    orderName: order?.name ?? null,
    total: { amount: checkout.totalAmount, currency: checkout.currency },
  };
}

function refuseUnreadyCart(cart: PricedCart): void {
  const missing: string[] = [];
  if (cart.lines.length === 0) missing.push("lines");
  if (!cart.row.email) missing.push("email");
  if (!cart.row.shippingAddress) missing.push("shippingAddress");
  if (!cart.chosenShipping) missing.push("shippingRateId");
  if (missing.length > 0) {
    throw new CartNotReadyError(
      cart.lines.length === 0
        ? "The cart is empty."
        : "Please add an email address, a delivery address and a shipping option first.",
      missing,
    );
  }
  const problem = cart.lines.find((line) => line.problem !== null);
  if (problem?.problem === "out_of_stock" || problem?.problem === "not_enough_stock") {
    // The same answer the stock reservation gives, so storefronts handle one case.
    throw new OutOfStockError(
      problem.variantId,
      describeLine(problem.productTitle, problem.variantTitle),
      problem.quantityAvailable ?? 0,
    );
  }
  if (problem) {
    throw new CartNotReadyError(
      `${describeLine(problem.productTitle, problem.variantTitle)} can't be bought as it is. Change or remove it first.`,
      ["lines"],
    );
  }
}

/**
 * When the site lists its addresses in Build → API access, Stripe may only send
 * shoppers back to those, so a stolen cart token can't be used to send them somewhere else.
 */
async function refuseUnknownPages(shop: ShopContext, request: StartCheckoutRequest): Promise<void> {
  if (!request.successUrl || !request.cancelUrl) {
    throw new CartNotReadyError("Please send successUrl and cancelUrl for the payment page.", [
      "successUrl",
      "cancelUrl",
    ]);
  }
  const allowed = await readSetting(shop.database, "deliveryAllowedOrigins");
  if (allowed.length === 0) return;
  for (const page of [request.successUrl, request.cancelUrl]) {
    if (!allowed.includes(new URL(page).origin)) {
      throw new ShopNotReadyError(
        `${new URL(page).origin} isn't one of the site's addresses in Build → API access.`,
      );
    }
  }
}

async function calculateTax(
  shop: ShopContext,
  cart: PricedCart,
  checkoutId: string,
): Promise<TaxResult> {
  const provider = await chooseTaxProvider(shop);
  const address = cart.row.shippingAddress;
  if (!address) throw new Error("Tax needs a delivery address");
  try {
    return await provider.calculateTax({
      currency: cart.market.currency,
      taxesIncluded: cart.market.pricesIncludeTax,
      address,
      lines: cart.lines.map((line) => ({
        reference: line.variantId,
        amount: line.subtotal.amount - line.discountAmount,
        quantity: line.quantity,
      })),
      shippingAmount: cart.chosenShipping?.amount.amount ?? 0,
      idempotencyKey: `lintel-tax-${checkoutId}`,
    });
  } catch (error) {
    throw explainProviderError(error, "stripe", "work out the tax");
  }
}

async function closeReplacedPayments(
  shop: ShopContext,
  replaced: readonly CheckoutRow[],
): Promise<void> {
  for (const checkout of replaced) {
    await closeProviderPayment(shop, checkout);
  }
}

/**
 * A code that was fine in the cart may have expired or been used up since. The shopper is
 * told before they pay, rather than paying more than the cart said.
 */
function refuseUnusableDiscounts(cart: PricedCart): void {
  const problem = cart.discountProblems.find((candidate) => candidate.blocking);
  if (problem) {
    throw new DiscountCodeError(problem.code, problem.message, 409);
  }
}

function explainProviderError(
  error: unknown,
  providerId: PaymentProviderId,
  action: string,
): unknown {
  if (error instanceof StripeRequestError || error instanceof ProviderRequestError) {
    return new PaymentProviderError(
      `${PAYMENT_PROVIDER_NAMES[providerId]} couldn't ${action}: ${error.message}`,
    );
  }
  return error;
}
