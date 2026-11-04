import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { isPluginEnabled } from "../../plugins/plugins.service.js";
import { listOpenCheckoutRowsForProvider } from "../checkouts/checkouts.repository.js";
import type { ShopContext } from "../commerce.context.js";
import { countOrdersPaidSince } from "../orders/orders.repository.js";
import { listOrdersWithPendingRefunds } from "../orders/refunds-and-fulfilments.repository.js";
import { updateShopSettingsRow } from "../settings/shop-settings.repository.js";
import { readShopSettingsRow } from "../settings/shop-settings.service.js";
import { needsOwnChecks } from "./local-address.js";
import { findMollieCredentials, mollieWebhookUrl } from "./mollie/mollie-provider.js";
import { handleMollieWebhook } from "./mollie/mollie-webhook.service.js";
import type { MarketPaymentProviderId } from "./payment-provider.js";
import { findPayPalCredentials } from "./paypal/paypal-provider.js";
import {
  confirmPayPalCheckout,
  settlePendingPayPalRefunds,
} from "./paypal/paypal-webhook.service.js";
import { listStripeEvents } from "./stripe-api.js";
import { STRIPE_WEBHOOK_EVENTS } from "./stripe-webhook-events.js";
import { applyStripeEvent } from "./stripe-webhook.service.js";

/**
 * A shop no webhook can reach (on someone's own computer, or with no webhook set up yet)
 * still has to hear about shoppers who close the tab, delayed payments and refunds. So Lintel
 * asks the provider itself, with the shop's own key, and handles the answer exactly as it
 * would a webhook. Nothing needs setting up.
 *
 *   Stripe   reads its list of events and passes each through the webhook's handler, with
 *            the same record of handled events, so an event is never handled twice
 *   PayPal   has no list of events without a webhook, so each open checkout's order is
 *            fetched, and refunds still pending
 *   Mollie   has no list of events at all, so each open payment is fetched, and each order
 *            with a refund still pending
 *
 * A shop with its webhook set up never gets here. Providers are only asked while something
 * is happening (an open checkout, a recent payment, a pending refund). Otherwise Stripe is
 * asked every five minutes, for refunds made in its dashboard, and the others not at all.
 */

const CHECK_EVERY_MS = 5_000;
const NOTHING_TO_CHECK_MS = 60_000;
const QUIET_STRIPE_CHECK_MS = 5 * 60_000;
const LONGEST_BACK_OFF_MS = 5 * 60_000;
const RECENT_PAYMENT_MS = 10 * 60_000;
/** Before anything was read, how far back to look. */
const FIRST_LOOK_BACK_MS = 24 * 60 * 60_000;
/** Stripe's list can take a moment to show an event, so each read overlaps the last. */
const EVENT_OVERLAP_SECONDS = 120;

export interface PaymentCheckState {
  /** Nothing is happening, so Stripe needn't be asked until then. */
  quietUntil: number;
  /** Failed rounds in a row, which space the checks out. */
  failures: number;
}

export function newPaymentCheckState(): PaymentCheckState {
  return { quietUntil: 0, failures: 0 };
}

/** One round of checks. Answers how long to wait before the next. */
export async function checkPayments(shop: ShopContext, state: PaymentCheckState): Promise<number> {
  if (!(await isPluginEnabled(shop.database, "commerce"))) return NOTHING_TO_CHECK_MS;
  const checks = await paymentChecksNeeded(shop);
  if (checks.length === 0) return NOTHING_TO_CHECK_MS;

  let failed = false;
  for (const check of checks) {
    try {
      if (check === "stripe") await checkStripe(shop, state);
      if (check === "paypal") await checkPayPal(shop);
      if (check === "mollie") await checkMollie(shop);
    } catch (error) {
      failed = true;
      shop.log.error(error, `Checking with ${check} for payments failed`);
    }
  }
  state.failures = failed ? state.failures + 1 : 0;
  return Math.min(CHECK_EVERY_MS * 2 ** state.failures, LONGEST_BACK_OFF_MS);
}

/** Which providers are connected and have no webhook doing the work. */
export async function paymentChecksNeeded(shop: ShopContext): Promise<MarketPaymentProviderId[]> {
  const keys = await shop.stripeKeys();
  const paypal = await findPayPalCredentials(shop);
  const mollie = await findMollieCredentials(shop);
  const url = shop.publicApiUrl;
  return [
    ...(keys.secretKey && needsOwnChecks(url, keys.webhookSecret !== null)
      ? (["stripe"] as const)
      : []),
    ...(paypal && needsOwnChecks(url, paypal.webhookId !== null) ? (["paypal"] as const) : []),
    ...(mollie && mollieWebhookUrl(url) === null ? (["mollie"] as const) : []),
  ];
}

async function checkStripe(shop: ShopContext, state: PaymentCheckState): Promise<void> {
  const now = shop.now();
  if (!(await stripeIsBusy(shop, now)) && now.getTime() < state.quietUntil) return;

  const settings = await readShopSettingsRow(shop.database);
  const from = settings.stripeEventsCheckedUntil ?? new Date(now.getTime() - FIRST_LOOK_BACK_MS);
  const events = await listStripeEvents(await shop.stripe(), {
    createdFrom: Math.floor(from.getTime() / 1000) - EVENT_OVERLAP_SECONDS,
    types: STRIPE_WEBHOOK_EVENTS,
  });

  // A failure leaves the place at that event, so it's read again next time; the ones after it
  // are still handled, and the record of handled events skips them when they come round.
  let checkedUntil = now;
  let problem: unknown;
  for (const event of events) {
    try {
      await applyStripeEvent(shop, event);
    } catch (error) {
      problem ??= error;
      const created = new Date((event.created ?? 0) * 1000);
      if (created < checkedUntil) checkedUntil = created;
    }
  }
  await updateShopSettingsRow(shop.database, DEFAULT_TENANT_ID, {
    stripeEventsCheckedUntil: checkedUntil,
  });
  state.quietUntil = now.getTime() + QUIET_STRIPE_CHECK_MS;
  if (problem !== undefined) throw problem;
}

async function stripeIsBusy(shop: ShopContext, now: Date): Promise<boolean> {
  const open = await listOpenCheckoutRowsForProvider(shop.database, "stripe", 1);
  if (open.length > 0) return true;
  const since = new Date(now.getTime() - RECENT_PAYMENT_MS);
  if ((await countOrdersPaidSince(shop.database, "stripe", since)) > 0) return true;
  return (await listOrdersWithPendingRefunds(shop.database, "stripe")).length > 0;
}

/** Checks every item, so one payment that can't be read doesn't hold up the others. */
async function checkEach<Item>(
  items: Iterable<Item>,
  check: (item: Item) => Promise<unknown>,
): Promise<void> {
  const problems: unknown[] = [];
  for (const item of items) {
    await check(item).catch((error: unknown) => problems.push(error));
  }
  if (problems.length > 0) throw problems[0];
}

async function checkPayPal(shop: ShopContext): Promise<void> {
  const checkouts = await listOpenCheckoutRowsForProvider(shop.database, "paypal");
  await checkEach(
    [
      ...checkouts.map((checkout) => () => confirmPayPalCheckout(shop, checkout)),
      () => settlePendingPayPalRefunds(shop),
    ],
    (check) => check(),
  );
}

async function checkMollie(shop: ShopContext): Promise<void> {
  const paymentIds = new Set<string>();
  for (const checkout of await listOpenCheckoutRowsForProvider(shop.database, "mollie")) {
    if (checkout.providerPaymentId) paymentIds.add(checkout.providerPaymentId);
  }
  for (const order of await listOrdersWithPendingRefunds(shop.database, "mollie")) {
    if (order.providerPaymentId) paymentIds.add(order.providerPaymentId);
  }
  await checkEach(paymentIds, (paymentId) => handleMollieWebhook(shop, paymentId));
}

/** Keeps checking until the server stops; each round says when the next one is. */
export function startPaymentChecks(shop: ShopContext): { stop(): Promise<void> } {
  const state = newPaymentCheckState();
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  let running: Promise<void> = Promise.resolve();

  const run = async () => {
    let wait = NOTHING_TO_CHECK_MS;
    try {
      wait = await checkPayments(shop, state);
    } catch (error) {
      shop.log.error(error, "Checking for payments failed");
    }
    if (stopped) return;
    timer = setTimeout(() => {
      running = run();
    }, wait);
    timer.unref();
  };
  running = run();

  return {
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await running;
    },
  };
}
